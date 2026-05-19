"""
Starlette middleware for the Privacy Browser backend:
- Rate limiting (sliding window, IP-based, with temporary block-list)
- Request-body size limit
- URL/JSON validation (no XSS / SQLi patterns through the request body)
- Security headers
- Structured request logging without sensitive-data leakage
"""

import asyncio
import ipaddress
import json
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from security_config import (
    get_security_config,
    log_security_event,
    validate_request_size,
    SecurityError,
    is_valid_url,
)

security_config = get_security_config()

_SUSPICIOUS_PATTERNS = [
    re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL),
    re.compile(r'union\s+select', re.IGNORECASE),
    re.compile(r'drop\s+table', re.IGNORECASE),
    re.compile(r'exec\s*\(', re.IGNORECASE),
    re.compile(r'eval\s*\(', re.IGNORECASE),
    re.compile(r'javascript:', re.IGNORECASE),
    re.compile(r'data:text/html', re.IGNORECASE),
    re.compile(r'vbscript:', re.IGNORECASE),
]


class RateLimiter:
    """Sliding-window rate limiter with 15-minute block on violation."""

    def __init__(self):
        self._requests: Dict[str, deque] = defaultdict(deque)
        self._blocked_until: Dict[str, datetime] = {}
        self._lock = asyncio.Lock()
        self._config = security_config.rate_limit_config

    async def is_allowed(self, client_ip: str) -> Tuple[bool, Optional[str]]:
        now_dt = datetime.utcnow()
        now_ts = time.time()
        async with self._lock:
            blocked_until = self._blocked_until.get(client_ip)
            if blocked_until:
                if now_dt < blocked_until:
                    return False, "Temporarily blocked due to rate-limit violation"
                del self._blocked_until[client_ip]

            window_start = now_ts - self._config['window']
            q = self._requests[client_ip]
            while q and q[0] < window_start:
                q.popleft()

            if len(q) >= self._config['requests']:
                self._blocked_until[client_ip] = now_dt + timedelta(minutes=15)
                log_security_event("RATE_LIMIT_EXCEEDED", "IP blocked for 15 minutes", client_ip)
                return False, (
                    f"Rate limit exceeded: {self._config['requests']} requests "
                    f"per {self._config['window']} seconds"
                )

            q.append(now_ts)
            return True, None


_rate_limiter = RateLimiter()


def _get_client_ip(request: Request) -> str:
    # Use proxy headers only if FORWARDED_ALLOW_IPS allows.
    forwarded_for = request.headers.get('x-forwarded-for')
    if forwarded_for:
        first_ip = forwarded_for.split(',')[0].strip()
        try:
            ipaddress.ip_address(first_ip)
            return first_ip
        except ValueError:
            pass

    real_ip = request.headers.get('x-real-ip')
    if real_ip:
        try:
            ipaddress.ip_address(real_ip)
            return real_ip
        except ValueError:
            pass

    return request.client.host if request.client else "unknown"


def _check_string(value: str, ctx: str) -> None:
    if not isinstance(value, str):
        return
    if len(value) > 100_000:
        raise SecurityError(f"String too long in {ctx}")
    for pat in _SUSPICIOUS_PATTERNS:
        if pat.search(value):
            raise SecurityError(f"Suspicious pattern in {ctx}")


def _validate_json(data, ctx: str = "json") -> None:
    if isinstance(data, str):
        _check_string(data, ctx)
    elif isinstance(data, dict):
        for k, v in data.items():
            _validate_json(v, ctx + '.' + str(k)[:32])
    elif isinstance(data, list):
        for i, item in enumerate(data):
            if i > 1000:
                raise SecurityError(f"Array too large in {ctx}")
            _validate_json(item, ctx + f'[{i}]')


class SecurityMiddleware(BaseHTTPMiddleware):
    """Per-request size limit, rate limit, pattern check, security headers."""

    async def dispatch(self, request: Request, call_next):
        client_ip = _get_client_ip(request)
        try:
            # 1. Body size guard
            content_length = int(request.headers.get('content-length', 0) or 0)
            if content_length:
                validate_request_size(content_length)

            # 2. Rate limit
            allowed, msg = await _rate_limiter.is_allowed(client_ip)
            if not allowed:
                resp = JSONResponse(
                    status_code=429,
                    content={"error": "Too Many Requests", "detail": msg},
                )
                self._apply_security_headers(resp)
                return resp

            # 3. URL/path quick scan
            path = str(request.url.path)
            for pat in _SUSPICIOUS_PATTERNS:
                if pat.search(path):
                    raise SecurityError("Suspicious URL path")

            for key, value in request.query_params.items():
                _check_string(key, "query-key")
                _check_string(value, "query-val")
                if key.lower() in ('url', 'link', 'href') or (isinstance(value, str) and value.startswith(('http://', 'https://'))):
                    if not is_valid_url(value):
                        raise SecurityError(f"Invalid/forbidden URL in query parameter '{key}'")

            # 4. Body scan for POST/PUT
            if request.method in ('POST', 'PUT', 'PATCH'):
                raw_body = await request.body()
                if raw_body:
                    try:
                        data = json.loads(raw_body.decode('utf-8'))
                        _validate_json(data, ctx="body")

                        # If body has a `url` key, require it to pass SSRF guard.
                        if isinstance(data, dict) and isinstance(data.get('url'), str) and data['url']:
                            if not is_valid_url(data['url']):
                                raise SecurityError("URL rejected by SSRF guard")
                    except json.JSONDecodeError:
                        _check_string(raw_body.decode('utf-8', errors='replace'), "body")

                # Restore request._body so downstream handlers can re-read it.
                # Starlette's Request caches _body; assignment is supported.
                request._body = raw_body  # type: ignore[attr-defined]

            response = await call_next(request)
            self._apply_security_headers(response)
            return response

        except SecurityError as e:
            log_security_event("SECURITY_VIOLATION", str(e), client_ip)
            resp = JSONResponse(
                status_code=403,
                content={"error": "Forbidden", "detail": str(e)},
            )
            self._apply_security_headers(resp)
            return resp
        except Exception as e:
            log_security_event("MIDDLEWARE_ERROR", str(e), client_ip)
            resp = JSONResponse(
                status_code=500,
                content={"error": "Internal Server Error"},
            )
            self._apply_security_headers(resp)
            return resp

    @staticmethod
    def _apply_security_headers(response):
        for k, v in security_config.get_security_headers().items():
            response.headers[k] = v


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Structured access logging (status + duration) with sanitized UA."""

    async def dispatch(self, request: Request, call_next):
        start = time.time()
        ip = _get_client_ip(request)
        ua = security_config.sanitize_log_data(request.headers.get('user-agent', '')[:200])
        info = {
            "method": request.method,
            "path": str(request.url.path),
            "ip": ip,
            "ua": ua,
            "ts": datetime.utcnow().isoformat(),
        }
        try:
            response = await call_next(request)
            duration_ms = round((time.time() - start) * 1000, 1)
            info["status"] = response.status_code
            info["duration_ms"] = duration_ms
            if response.status_code >= 500:
                log_security_event("SERVER_ERROR", json.dumps(info), ip)
            elif response.status_code >= 400:
                log_security_event("CLIENT_ERROR", json.dumps(info), ip)
            return response
        except Exception as e:
            info["error"] = str(e)[:500]
            info["duration_ms"] = round((time.time() - start) * 1000, 1)
            log_security_event("REQUEST_ERROR", json.dumps(info), ip)
            raise
