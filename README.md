# Poliscope — Version 3.1

**AI-Powered Privacy Policy Analysis + Tracker Blocking Chrome Extension**

A privacy-focused Chrome extension and FastAPI backend that:
- Analyzes website privacy policies via LLM (Groq) with a deterministic
  heuristic fallback.
- Blocks trackers/ads via Manifest V3 `declarativeNetRequest` rulesets.
- Auto-rejects cookie consent banners (scoped to the banner DOM only).
- Sends GPC and DNT signals on every navigation.
- Lets the user block specific data categories per site.

---

## Architecture

```
┌────────────────────────┐   HTTPS    ┌─────────────────────────────┐
│ Chrome Extension (MV3) │ ────────►  │ FastAPI backend (Render)    │
│  - Side panel UI       │            │  - SecurityMiddleware       │
│  - Tracker blocking    │            │  - SSRF-safe URL validation │
│  - Cookie auto-reject  │            │  - Groq LLM analyzer        │
│  - Form scanner        │            │  - Ultra fetcher (4 strats) │
└────────────────────────┘            └─────────────────────────────┘
            ▲
            │ (optional) shared core
            ▼
┌────────────────────────┐
│ Vercel frontend (Vite) │
│  - React SPA           │
│  - /api proxy rewrite  │
└────────────────────────┘
```

- **Extension** (`Extension/`): vendored Chart.js and Inter fonts; no remote
  CDN code or fonts. Strict CSP in `manifest.json`. HTTPS-only host
  permissions.
- **Backend** (`Backend/`): FastAPI + gunicorn + uvicorn workers. Wired
  rate limiter, body-size guard, security headers, SSRF-safe URL validation.
- **Frontend** (`Frontend/`): React SPA deployed on Vercel; rewrites
  `/api/*` to the HTTPS Render backend.

---

## Quick Start (local development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- (Optional) Docker

### Backend

```bash
cd Backend
python -m venv venv && source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set development secrets (any random strings work in dev):
export GROQ_API_KEY="your-groq-key"                # optional but recommended
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export ENCRYPTION_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export API_KEY_HASH_SALT="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"

uvicorn main_optimized:app --reload --host 0.0.0.0 --port 5001
```

In dev, secrets aren't required — the app generates ephemeral random values
per boot. In production (`ENV=production` or `RENDER=true`), the app refuses
to start without them.

### Frontend

```bash
cd Frontend
npm ci
npm run dev          # http://localhost:5173
```

### Extension

1. Open `chrome://extensions`
2. Toggle **Developer mode**
3. Click **Load unpacked** and pick the `Extension/` directory

The extension talks to `https://privacybrowser-backend.onrender.com` by
default; for local dev, edit `Extension/sidepanel.js:8` to point at
`http://localhost:5001` (and add a matching `host_permissions` entry).

---

## Production Deployment

### Backend (Render)

`render.yaml` declares the service. On first deploy:

1. Push this repo to the GitHub remote.
2. In the Render dashboard: New → **Blueprint** → pick this repo.
3. Render reads `render.yaml`, creates the service, and auto-generates the
   four required secrets (`SECRET_KEY`, `ENCRYPTION_KEY`, `JWT_SECRET`,
   `API_KEY_HASH_SALT`, `STATS_TOKEN`).
4. Manually set in the dashboard:
   - `GROQ_API_KEY`   – grab a free key at https://console.groq.com
   - `FIRECRAWL_API_KEY` – optional, for JS-heavy site fetching
   - `ALLOWED_ORIGINS` – override with your published Vercel domain
   - `ALLOWED_ORIGIN_REGEX` – set to `^chrome-extension://[a-z]{32}$` once you
     publish the extension (or leave the default).
5. The blueprint also creates a **cron** service
   (`privacybrowser-keepalive`) that pings `/health` every 10 minutes — this
   defeats Render's free-tier 15-minute idle sleep without an external uptime
   monitor.

Render auto-deploys on git push to the connected branch.

### Frontend (Vercel)

1. New project → import this GitHub repo
2. Set root directory to `Frontend/`
3. Vercel detects Vite automatically; nothing to configure
4. `vercel.json` proxies `/api/*` → HTTPS Render backend

### Docker (self-hosted)

```bash
export SECRET_KEY=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 32)
export JWT_SECRET=$(openssl rand -hex 32)
export API_KEY_HASH_SALT=$(openssl rand -hex 16)
export GROQ_API_KEY=...                       # optional
export ALLOWED_ORIGINS=https://your-domain.example
docker compose up -d
```

Production stack: `docker-compose.prod.yml` adds resource limits, multi-stage
builds, and runs the backend as a non-root user.

---

## Pushing the v3.1 release

Run these commands locally:

```bash
cd "D:\Privacy browser\.claude\worktrees\peaceful-lumiere-ca85f6"

# Stage everything
git add -A

# Commit
git commit -m "v3.1: security hardening, MV3 compliance, deployment fixes"

# Push to the existing claude branch
git push origin claude/peaceful-lumiere-ca85f6
```

Render's `autoDeploy: true` will redeploy automatically on push. The cron
keep-alive service is created on the first blueprint apply — if you already
deployed an older version, re-sync the blueprint from the Render dashboard:
**Settings → Sync from Blueprint**.

After Render reports the deploy is live (≈3–5 min on free tier), verify:

```bash
curl -s https://privacybrowser-backend.onrender.com/health
# {"status":"ok","timestamp":"..."}

curl -s https://privacybrowser-backend.onrender.com/ | jq .version
# "3.1.0"
```

---

## API Endpoints

| Method | Path                       | Purpose                                      |
|-------:|----------------------------|----------------------------------------------|
| GET    | `/`                        | API info + endpoint list                     |
| GET    | `/health`                  | Health check (used by Render + uptime cron)  |
| GET    | `/test-simple`             | Simple liveness probe                        |
| POST   | `/fetch-privacy-policy`    | `{"url": "..."}` → policy text + metadata    |
| POST   | `/analyze-direct-policy`   | `{"url"|"policy_text": "..."}` → analysis    |
| POST   | `/analyze-policy`          | `{"policy_text": "..."}` → analysis          |
| GET    | `/stats`                   | Requires `Authorization: Bearer $STATS_TOKEN`|

All POST endpoints validate URLs through an SSRF-safe filter that rejects
private, loopback, link-local, reserved, and cloud-metadata addresses.

---

## Security posture

- **SSRF guard**: `security_config.is_valid_url` resolves DNS and rejects any
  host whose A/AAAA falls in private/loopback/link-local/reserved/multicast
  ranges, plus known cloud-metadata hostnames.
- **Rate limit**: 60 requests / hour / IP (configurable); 15-minute block on
  violation.
- **Body size**: 256 KB limit; `policy_text` capped at 60 KB.
- **CSP**: backend sets strict CSP; extension declares its own CSP forbidding
  remote scripts (`script-src 'self'`).
- **Prompt injection**: policy text is wrapped in `<policy>...</policy>` tags
  with explicit "treat as data" instructions; LLM output is recursively
  HTML-stripped before reaching the UI.
- **Secrets**: refuses to boot in production without `SECRET_KEY`,
  `ENCRYPTION_KEY`, `JWT_SECRET`, `API_KEY_HASH_SALT`. Dev mode generates
  ephemeral random values per boot (never written to `os.environ`).
- **Stats endpoint** is auth-gated; returns 404 when `STATS_TOKEN` is unset.
- **Extension XSS**: every backend-derived string is HTML-escaped before
  insertion into `innerHTML`; `user_friendly_summary` is rendered with
  `textContent` only.

---

## Performance

| Metric                  | Cold start | Warm        |
|-------------------------|------------|-------------|
| Render `/health`        | 30–60 s    | < 1 s       |
| First policy fetch      | 8–15 s     | 2–4 s       |
| Cached fetch (memory)   | —          | < 5 ms      |
| LLM analysis (Groq)     | 4–8 s      | 4–8 s       |

The keep-alive cron prevents cold starts after the first deploy.

---

## Repository layout

```
.
├── Backend/
│   ├── main_optimized.py        # FastAPI app, lifespan, routes
│   ├── security_config.py       # secrets, SSRF guard, CORS
│   ├── middleware.py            # rate limit, body validation, headers
│   ├── llm_analyzer.py          # Groq + heuristic fallback
│   ├── ultra_fetcher.py         # 4-strategy policy fetcher
│   ├── firecrawl_fetcher.py     # optional JS-heavy fallback
│   ├── gunicorn.conf.py         # 1 worker on Render free; WEB_CONCURRENCY-aware
│   ├── Dockerfile               # slim, non-root, no Chrome
│   └── requirements.txt         # selenium removed
├── Extension/
│   ├── manifest.json            # MV3, strict CSP, HTTPS-only host perms
│   ├── background.js            # SW with getMatchedRules polling
│   ├── content.js               # cookie auto-reject, ad CSS, scoped
│   ├── data-blocker.js          # isolated-world surface
│   ├── page-inject.js           # MAIN-world fingerprint blocker
│   ├── popup.js / sidepanel.js  # XSS-safe interpolation, retry-fetch
│   ├── youtube-adblock.js       # observer-driven skip
│   ├── lib/chart.min.js         # vendored Chart.js
│   ├── fonts/inter-*.woff2      # vendored Inter
│   └── rules/                   # tracker + youtube DNR rules
├── Frontend/
│   ├── src/                     # React SPA
│   ├── Dockerfile               # multi-stage; vite installs in build stage
│   ├── nginx.conf               # strict CSP, immutable static assets
│   └── vercel.json              # /api proxy to HTTPS Render backend
├── docker-compose.yml           # dev compose; nginx-proxy owns :80
├── docker-compose.prod.yml      # production compose
├── nginx-proxy.conf             # rate-limited reverse proxy
└── render.yaml                  # Render blueprint (backend + cron + static)
```

---

## License

See LICENSE.

---

*Version 3.1 — production-hardened release. v3.0 audit findings (Chrome Web Store
blockers, SSRF, broken Dockerfile, missing Chart.js, etc.) are all addressed.*
