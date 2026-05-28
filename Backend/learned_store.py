"""
Persistent store for learned (verified) privacy-policy URLs.

Backends:
  - Postgres (Neon) via asyncpg  — when DATABASE_URL / NEON_DATABASE_URL is set.
    Survives across deploys/restarts, so the tool's knowledge of correct policy
    URLs keeps accumulating over its whole lifetime.
  - Local JSON file              — automatic fallback when no DB is configured
    or the DB is unreachable (e.g. local dev).

An in-memory dict mirrors the backend for fast synchronous reads on the hot
path; writes go through to the backend.
"""
import os
import re
import json
import ssl
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)

try:
    import asyncpg
    ASYNCPG_AVAILABLE = True
except ImportError:
    ASYNCPG_AVAILABLE = False
    logger.info("asyncpg not installed — learned-policy store will use file backend")

try:
    import aiofiles
    AIOFILES_AVAILABLE = True
except ImportError:
    AIOFILES_AVAILABLE = False


class LearnedPolicyStore:
    """domain -> verified policy URL registry with DB or file persistence."""

    def __init__(self, file_path, max_entries: int = 5000):
        self.file_path = Path(file_path)
        self.max_entries = max_entries
        self.cache: Dict[str, dict] = {}
        self.pool = None
        self.use_db = False
        self._db_url = (
            os.getenv("DATABASE_URL")
            or os.getenv("NEON_DATABASE_URL")
            or os.getenv("POSTGRES_URL")
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def initialize(self):
        """Connect to Postgres (and create the table) or load the JSON file."""
        if self._db_url and ASYNCPG_AVAILABLE:
            try:
                self.pool = await self._create_pool(self._db_url)
                async with self.pool.acquire() as conn:
                    await conn.execute(
                        """
                        CREATE TABLE IF NOT EXISTS learned_policies (
                            domain      TEXT PRIMARY KEY,
                            policy_url  TEXT NOT NULL,
                            score       INTEGER     DEFAULT 0,
                            verified_at TIMESTAMPTZ DEFAULT now(),
                            last_used   TIMESTAMPTZ DEFAULT now(),
                            hit_count   INTEGER     DEFAULT 1
                        )
                        """
                    )
                    rows = await conn.fetch(
                        "SELECT domain, policy_url, score, hit_count FROM learned_policies"
                    )
                    for r in rows:
                        self.cache[r["domain"]] = {
                            "policy_url": r["policy_url"],
                            "score": r["score"],
                            "hit_count": r["hit_count"],
                        }
                self.use_db = True
                logger.info(
                    f"LearnedPolicyStore: Postgres backend ready ({len(self.cache)} entries loaded)"
                )
                return
            except Exception as e:
                logger.warning(
                    f"LearnedPolicyStore: Postgres init failed ({e}); falling back to file"
                )
                self.pool = None
                self.use_db = False

        # File fallback
        self._load_file()
        logger.info(f"LearnedPolicyStore: file backend ({len(self.cache)} entries)")

    async def _create_pool(self, dsn: str):
        """Create an asyncpg pool, handling Neon/managed-Postgres SSL.

        asyncpg does not reliably honor `sslmode`/`channel_binding` query
        params, so we strip them and pass an explicit SSL context instead.
        """
        clean = re.sub(r"[?&](sslmode|channel_binding)=[^&]*", "", dsn)
        clean = clean.replace("?&", "?").rstrip("?&")
        ctx = ssl.create_default_context()
        return await asyncpg.create_pool(
            clean,
            ssl=ctx,
            min_size=1,
            max_size=5,
            command_timeout=15,
        )

    async def close(self):
        if self.pool:
            try:
                await self.pool.close()
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Reads (synchronous, from in-memory mirror)
    # ------------------------------------------------------------------
    def get(self, domain: str) -> Optional[str]:
        entry = self.cache.get(domain)
        if isinstance(entry, dict):
            return entry.get("policy_url")
        return None

    def count(self) -> int:
        return len(self.cache)

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------
    async def save(self, domain: str, policy_url: str, score: int):
        if not domain or not policy_url:
            return
        score = int(score) if isinstance(score, (int, float)) else 0
        existing = self.cache.get(domain, {}) or {}
        self.cache[domain] = {
            "policy_url": policy_url,
            "score": score,
            "hit_count": int(existing.get("hit_count", 0)) + 1,
        }

        if self.use_db and self.pool:
            try:
                async with self.pool.acquire() as conn:
                    await conn.execute(
                        """
                        INSERT INTO learned_policies (domain, policy_url, score, verified_at, last_used, hit_count)
                        VALUES ($1, $2, $3, now(), now(), 1)
                        ON CONFLICT (domain) DO UPDATE SET
                            policy_url = EXCLUDED.policy_url,
                            score      = EXCLUDED.score,
                            last_used  = now(),
                            hit_count  = learned_policies.hit_count + 1
                        """,
                        domain, policy_url, score,
                    )
                return
            except Exception as e:
                logger.warning(f"LearnedPolicyStore: DB save failed for {domain} ({e})")
                # fall through to file persistence as a safety net

        self._evict_if_needed()
        await self._persist_file()

    async def invalidate(self, domain: str):
        self.cache.pop(domain, None)
        if self.use_db and self.pool:
            try:
                async with self.pool.acquire() as conn:
                    await conn.execute(
                        "DELETE FROM learned_policies WHERE domain = $1", domain
                    )
                return
            except Exception as e:
                logger.warning(f"LearnedPolicyStore: DB delete failed for {domain} ({e})")
        await self._persist_file()

    # ------------------------------------------------------------------
    # File backend helpers
    # ------------------------------------------------------------------
    def _load_file(self):
        try:
            if self.file_path.exists():
                with open(self.file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        self.cache = data
        except Exception as e:
            logger.warning(f"LearnedPolicyStore: could not load file ({e})")
            self.cache = {}

    def _evict_if_needed(self):
        if len(self.cache) > self.max_entries:
            # Drop lowest-hit entries first (cheap proxy for least useful).
            ordered = sorted(
                self.cache.items(), key=lambda kv: kv[1].get("hit_count", 0)
            )
            for stale_domain, _ in ordered[: len(self.cache) - self.max_entries]:
                self.cache.pop(stale_domain, None)

    async def _persist_file(self):
        try:
            payload = json.dumps(self.cache, ensure_ascii=False, indent=2)
            tmp = self.file_path.with_suffix(".json.tmp")
            if AIOFILES_AVAILABLE:
                async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
                    await f.write(payload)
            else:
                with open(tmp, "w", encoding="utf-8") as f:
                    f.write(payload)
            tmp.replace(self.file_path)
        except Exception as e:
            logger.warning(f"LearnedPolicyStore: could not persist file ({e})")
