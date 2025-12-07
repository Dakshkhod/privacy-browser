# Gunicorn configuration file for production deployment

# Server socket
# Use PORT environment variable for Render compatibility
import os
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
backlog = 2048

# Worker processes
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
preload_app = True

# Timeout settings
timeout = 120
keepalive = 2
graceful_timeout = 30

# Logging - Use stdout/stderr for cloud deployments (Render, etc.)
# This allows Render to capture logs automatically
accesslog = "-"  # stdout
errorlog = "-"   # stderr
loglevel = "info"
access_log_format = ('%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s '
                     '"%(f)s" "%(a)s" %(D)s')

# Process naming
proc_name = "privacy-browser-backend"

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Performance
worker_tmp_dir = "/dev/shm"
forwarded_allow_ips = "*"

# Health check


def when_ready(server):
    server.log.info("Server is ready. Spawning workers")


def worker_int(worker):
    worker.log.info("worker received INT or QUIT signal")


def pre_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def post_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def post_worker_init(worker):
    worker.log.info("Worker initialized (pid: %s)", worker.pid)


def worker_abort(worker):
    worker.log.info("Worker aborted (pid: %s)", worker.pid)
