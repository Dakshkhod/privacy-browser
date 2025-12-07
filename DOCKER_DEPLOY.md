# Docker Deployment Guide 🐳

Complete guide to deploy Privacy Browser using Docker.

## 📋 Prerequisites

- **Docker** installed ([Download](https://www.docker.com/products/docker-desktop))
- **Docker Compose** installed (comes with Docker Desktop)
- At least **2GB RAM** available
- **10GB** free disk space

## 🚀 Quick Start (Development)

### Step 1: Clone Repository

```bash
git clone https://github.com/Dakshkhod/privacy-browser.git
cd privacy-browser
```

### Step 2: Create Environment File

Create `Backend/.env` file (or use `Backend/setup_environment.py`):

```bash
cd Backend
python setup_environment.py
# Or manually create .env with required variables
```

**Minimum required variables:**
```env
PORT=8000
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
DEBUG_MODE=false
ALLOWED_ORIGINS=http://localhost,http://localhost:5173
```

**Optional (for AI features):**
```env
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

**Security (generate using setup_environment.py):**
```env
SECRET_KEY=your_64_char_secret_key
ENCRYPTION_KEY=your_encryption_key
JWT_SECRET=your_64_char_jwt_secret
API_KEY_HASH_SALT=your_salt_value
```

### Step 3: Build and Start

```bash
# From project root
docker-compose up --build
```

This will:
- Build backend and frontend images
- Start all services
- Make app available at `http://localhost`

### Step 4: Access Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **Health Check**: http://localhost:8000/

## 🏭 Production Deployment

### Step 1: Update Environment Variables

Edit `docker-compose.prod.yml` or set environment variables:

```bash
export OPENAI_API_KEY=your_key
export SECRET_KEY=your_secret
export ENCRYPTION_KEY=your_encryption_key
export JWT_SECRET=your_jwt_secret
export API_KEY_HASH_SALT=your_salt
export ALLOWED_ORIGINS=https://yourdomain.com
```

### Step 2: Build Production Images

```bash
docker-compose -f docker-compose.prod.yml build
```

### Step 3: Start Production Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Step 4: Verify Deployment

```bash
# Check running containers
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Test health endpoint
curl http://localhost:8000/
```

## 📦 Docker Commands

### Development

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Rebuild and start
docker-compose up --build

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Production

```bash
# Start production services
docker-compose -f docker-compose.prod.yml up -d

# Stop production services
docker-compose -f docker-compose.prod.yml down

# Rebuild production
docker-compose -f docker-compose.prod.yml up --build -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart a service
docker-compose -f docker-compose.prod.yml restart backend
```

## 🔧 Individual Container Management

### Build Individual Images

```bash
# Build backend only
docker build -t privacy-browser-backend ./Backend

# Build frontend only
docker build -t privacy-browser-frontend ./Frontend

# Build production backend
docker build -f Backend/Dockerfile.prod -t privacy-browser-backend-prod ./Backend
```

### Run Individual Containers

```bash
# Run backend
docker run -d \
  -p 8000:8000 \
  -e PORT=8000 \
  -e BACKEND_HOST=0.0.0.0 \
  -e DEBUG_MODE=false \
  --name privacy-backend \
  privacy-browser-backend

# Run frontend
docker run -d \
  -p 80:80 \
  --name privacy-frontend \
  privacy-browser-frontend
```

## 🌐 Network Configuration

### Default Setup

- **Backend**: Port `8000`
- **Frontend**: Port `80`
- **Nginx Proxy**: Ports `80` and `443`

### Custom Ports

Edit `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "YOUR_PORT:8000"  # Change YOUR_PORT
  frontend:
    ports:
      - "YOUR_PORT:80"    # Change YOUR_PORT
```

## 🔒 SSL/HTTPS Setup

### Option 1: Use Nginx Proxy (Recommended)

1. Place SSL certificates in `./ssl/`:
   ```
   ssl/
     cert.pem
     key.pem
   ```

2. Update `nginx-proxy.conf` with your domain

3. Start with nginx-proxy service enabled

### Option 2: External Reverse Proxy

Use external reverse proxy (Cloudflare, AWS ALB, etc.) and disable nginx-proxy:

```yaml
# Comment out nginx-proxy service in docker-compose.yml
```

## 📊 Monitoring & Debugging

### View Container Status

```bash
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Execute Commands in Container

```bash
# Backend shell
docker-compose exec backend bash

# Frontend shell
docker-compose exec frontend sh

# Run Python command in backend
docker-compose exec backend python -c "print('Hello')"
```

### Check Resource Usage

```bash
docker stats
```

## 🗑️ Cleanup

### Stop and Remove Containers

```bash
docker-compose down
```

### Remove Containers and Volumes

```bash
docker-compose down -v
```

### Remove Images

```bash
docker-compose down --rmi all
```

### Complete Cleanup

```bash
# Remove containers, volumes, and images
docker-compose down -v --rmi all

# Remove unused Docker resources
docker system prune -a
```

## 🔄 Updates & Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up --build -d
```

### Update Dependencies

```bash
# Rebuild with no cache
docker-compose build --no-cache

# Restart services
docker-compose up -d
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check container status
docker-compose ps

# Restart service
docker-compose restart backend
```

### Port Already in Use

```bash
# Find process using port
# Windows
netstat -ano | findstr :8000

# Linux/Mac
lsof -i :8000

# Change port in docker-compose.yml
```

### Build Fails

```bash
# Clean build
docker-compose build --no-cache

# Check Dockerfile syntax
docker build -t test ./Backend
```

### Out of Memory

```bash
# Check Docker memory limits
docker stats

# Increase Docker Desktop memory limit
# Settings → Resources → Memory
```

### Database/Cache Issues

```bash
# Remove volumes and restart
docker-compose down -v
docker-compose up -d
```

## 📈 Production Best Practices

1. **Use Production Compose File**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Set Resource Limits**
   - Already configured in `docker-compose.prod.yml`

3. **Use Environment Variables**
   - Never hardcode secrets
   - Use `.env` files or Docker secrets

4. **Enable Health Checks**
   - Already configured in Dockerfiles

5. **Monitor Logs**
   ```bash
   docker-compose logs -f > app.log
   ```

6. **Backup Volumes**
   ```bash
   docker run --rm -v privacy-browser_backend-data:/data -v $(pwd):/backup \
     alpine tar czf /backup/backup.tar.gz /data
   ```

7. **Use Docker Swarm or Kubernetes**
   - For multi-host deployments
   - Better scalability and high availability

## 🚢 Deploy to Cloud

### AWS ECS / Fargate

1. Push images to ECR
2. Create ECS task definition
3. Deploy to Fargate

### Google Cloud Run

1. Build and push to GCR
2. Deploy using Cloud Run

### Azure Container Instances

1. Build and push to ACR
2. Deploy to Container Instances

### DigitalOcean App Platform

1. Connect GitHub repo
2. Use Dockerfile detection
3. Deploy automatically

## ✅ Verification Checklist

- [ ] Docker and Docker Compose installed
- [ ] Environment variables set
- [ ] Images built successfully
- [ ] Containers running
- [ ] Health checks passing
- [ ] Frontend accessible
- [ ] Backend API responding
- [ ] Logs show no errors

## 🆘 Need Help?

- Check logs: `docker-compose logs -f`
- Docker docs: https://docs.docker.com
- Compose docs: https://docs.docker.com/compose/

