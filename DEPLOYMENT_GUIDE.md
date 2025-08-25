# Privacy Browser - Deployment Guide

This guide will walk you through deploying your Privacy Browser tool to production hosting.

## 🚀 Quick Start (Recommended)

### 1. Prerequisites

- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Git** (to clone/update the repository)
- **Domain name** (for production hosting)
- **OpenAI API key** (for AI features)

### 2. One-Command Deployment

```bash
# Make the deployment script executable
chmod +x deploy.sh

# Run the automated deployment
./deploy.sh --domain yourdomain.com --email your@email.com
```

The script will:
- Check prerequisites
- Set up environment variables
- Generate SSL certificates
- Build and deploy all services
- Verify deployment health

## 🔧 Manual Deployment

### Step 1: Environment Setup

1. **Copy the environment template:**
   ```bash
   cp Backend/env.production.template Backend/.env
   ```

2. **Edit the `.env` file with your values:**
   ```bash
   nano Backend/.env
   ```

   **Required variables:**
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SECRET_KEY`: Strong secret key (64+ characters)
   - `ENCRYPTION_KEY`: Encryption key
   - `JWT_SECRET`: JWT signing secret (64+ characters)
   - `API_KEY_HASH_SALT`: Salt for API key hashing
   - `ALLOWED_ORIGINS`: Your domain(s)

3. **Generate strong keys (if needed):**
   ```bash
   cd Backend
   python setup_environment.py
   ```

### Step 2: SSL Certificates

#### Option A: Self-Signed (Development)
```bash
mkdir ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

#### Option B: Let's Encrypt (Production)
```bash
# Install certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
```

### Step 3: Deploy Services

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 🌐 Hosting Options

### 1. VPS/Cloud Server (Recommended)

**Recommended providers:**
- **DigitalOcean** ($5-20/month)
- **Linode** ($5-20/month)
- **Vultr** ($5-20/month)
- **AWS EC2** (t3.micro - free tier eligible)
- **Google Cloud** (e2-micro - free tier eligible)

**Server requirements:**
- **CPU**: 2+ cores
- **RAM**: 4GB+ (2GB minimum)
- **Storage**: 20GB+ SSD
- **OS**: Ubuntu 20.04+ or CentOS 8+

### 2. Shared Hosting

**Limitations:**
- No Docker support
- Limited Python support
- No root access

**Alternative deployment:**
- Use the traditional deployment method
- Install Python dependencies manually
- Use systemd for service management

### 3. Platform as a Service

**Options:**
- **Heroku** (limited free tier)
- **Railway** (generous free tier)
- **Render** (free tier available)
- **Fly.io** (generous free tier)

## 🔒 Security Considerations

### 1. Environment Variables
- **Never commit `.env` files** to version control
- Use strong, unique keys for each environment
- Rotate keys regularly

### 2. SSL/TLS
- Always use HTTPS in production
- Enable HSTS headers
- Use strong cipher suites

### 3. Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 4. Regular Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Monitoring and Maintenance

### 1. Health Checks
```bash
# Check service health
curl http://localhost:8000/health
curl http://localhost:3000/health

# View service logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### 2. Performance Monitoring
```bash
# Check resource usage
docker stats

# View container details
docker-compose -f docker-compose.prod.yml ps
```

### 3. Backup Strategy
```bash
# Backup data volumes
docker run --rm -v privacy-browser_backend-data:/data -v $(pwd):/backup alpine tar czf /backup/backend-data-$(date +%Y%m%d).tar.gz -C /data .

# Backup logs
docker run --rm -v privacy-browser_backend-logs:/logs -v $(pwd):/backup alpine tar czf /backup/backend-logs-$(date +%Y%m%d).tar.gz -C /logs .
```

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Find process using port
   sudo netstat -tulpn | grep :8000
   
   # Kill process
   sudo kill -9 <PID>
   ```

2. **Docker permission issues:**
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **SSL certificate errors:**
   ```bash
   # Check certificate validity
   openssl x509 -in ssl/cert.pem -text -noout
   
   # Regenerate if needed
   ./deploy.sh --domain yourdomain.com
   ```

4. **Service won't start:**
   ```bash
   # Check detailed logs
   docker-compose -f docker-compose.prod.yml logs backend
   
   # Restart services
   docker-compose -f docker-compose.prod.yml restart
   ```

### Getting Help

1. **Check the logs first:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

2. **Verify environment variables:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend env | grep -E "(OPENAI|SECRET|JWT)"
   ```

3. **Test individual services:**
   ```bash
   # Test backend
   curl -v http://localhost:8000/health
   
   # Test frontend
   curl -v http://localhost:3000/health
   ```

## 🔄 Updates and Maintenance

### 1. Application Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

### 2. Dependency Updates
```bash
# Update Python dependencies
cd Backend
pip install -r requirements-prod.txt --upgrade

# Update Node dependencies
cd ../Frontend
npm update

# Rebuild containers
docker-compose -f docker-compose.prod.yml up -d --build
```

### 3. SSL Certificate Renewal
```bash
# Let's Encrypt auto-renewal
sudo crontab -e

# Add this line for monthly renewal
0 0 1 * * certbot renew --quiet
```

## 📈 Scaling Considerations

### 1. Load Balancing
- Use multiple backend instances
- Implement Redis for session storage
- Consider using Traefik or HAProxy

### 2. Database Scaling
- Move from SQLite to PostgreSQL
- Implement read replicas
- Use connection pooling

### 3. Caching
- Redis for session and data caching
- CDN for static assets
- Browser caching optimization

## 🎯 Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Firewall configured
- [ ] Monitoring set up
- [ ] Backup strategy implemented
- [ ] Log rotation configured
- [ ] Health checks working
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Documentation updated

## 📞 Support

If you encounter issues:

1. **Check the logs first**
2. **Verify your configuration**
3. **Review this deployment guide**
4. **Check the troubleshooting section**
5. **Create an issue with detailed information**

---

**Happy Hosting! 🚀**

Your Privacy Browser tool is now ready for production deployment. Follow this guide step by step, and you'll have a secure, scalable, and maintainable application running in no time.
