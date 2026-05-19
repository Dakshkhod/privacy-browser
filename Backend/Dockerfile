# Privacy Browser Backend — slim, gunicorn-driven image
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Build/runtime deps. We DROP Chrome/Selenium here — Render free tier cannot
# host Chrome reliably; ultra_fetcher gracefully falls back without JS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        gcc g++ curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user and runtime dirs
RUN useradd --create-home --shell /usr/sbin/nologin appuser \
 && mkdir -p logs temp data/cache \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["gunicorn", "-c", "gunicorn.conf.py", "main_optimized:app"]
