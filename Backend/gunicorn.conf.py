# Gunicorn configuration for production deployment.
# Tuned for Render free tier (512 MB RAM) by default; override WEB_CONCURRENCY
# in larger plans.

import os
import sys

# ----- Bind -----
# Render injects PORT; default to 8000 for local docker.
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
backlog = 2048

# ----- Workers -----
# 1 worker is the safe ceiling on free tier; ~80MB per worker w/ spaCy.
workers = int(os.getenv('WEB_CONCURRENCY', '1'))
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
preload_app = True

# ----- Timeouts -----
timeout = 120
keepalive = 5
graceful_timeout = 30

# ----- Logging (stdout/stderr → Render log aggregator) -----
accesslog = "-"
errorlog = "-"
loglevel = os.getenv('LOG_LEVEL', 'info').lower()
access_log_format = ('%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s '
                     '"%(f)s" "%(a)s" %(D)s')

# ----- Process / perf -----
proc_name = "privacy-browser-backend"
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Linux-only optimization: keep worker tmp in /dev/shm for IPC speed.
if sys.platform.startswith('linux') and os.path.isdir('/dev/shm'):
    worker_tmp_dir = "/dev/shm"

# Trusted proxies. On Render, the platform's edge is the sole reverse proxy.
forwarded_allow_ips = os.getenv("FORWARDED_ALLOW_IPS", "*")


def when_ready(server):
    server.log.info("Server is ready. Spawning %d worker(s)", workers)


def post_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def worker_int(worker):
    worker.log.info("worker received INT or QUIT signal")
