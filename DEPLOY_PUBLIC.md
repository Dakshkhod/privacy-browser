# Deploy Privacy Browser for Public Access 🌐

Complete guide to deploy your app so others can access it online.

## 🎯 Quick Options Overview

| Platform | Cost | Difficulty | Best For |
|----------|------|------------|----------|
| **VPS (DigitalOcean/Linode)** | $5-12/month | Medium | Full control, best performance |
| **Fly.io** | Free tier | Easy | Quick deployment, global edge |
| **Railway** | $5/month | Easy | Simple setup, auto-deploy |
| **AWS/GCP/Azure** | Pay-as-you-go | Hard | Enterprise, scalable |
| **Heroku** | $7/month | Easy | Traditional PaaS |

## 🚀 Recommended: VPS Deployment (Best Value)

### Option 1: DigitalOcean Droplet ($5-12/month)

**Why DigitalOcean?**
- ✅ $5/month for basic VPS
- ✅ Full control
- ✅ Great performance
- ✅ Easy to scale
- ✅ Free $200 credit for new users

#### Step 1: Create Droplet

1. Sign up at [DigitalOcean](https://www.digitalocean.com)
2. Create new Droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($5/month - 1GB RAM) or Regular ($12/month - 2GB RAM)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or password

#### Step 2: Connect to Server

```bash
# SSH into your server
ssh root@your_server_ip

# Update system
apt update && apt upgrade -y
```

#### Step 3: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

#### Step 4: Clone Your Repository

```bash
# Install Git
apt install git -y

# Clone your repo
git clone https://github.com/Dakshkhod/privacy-browser.git
cd privacy-browser
```

#### Step 5: Set Up Environment

```bash
# Create .env file
cd Backend
nano .env
```

Add these variables:
```env
PORT=8000
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
DEBUG_MODE=false
ALLOWED_ORIGINS=https://yourdomain.com,http://your_server_ip
GROQ_API_KEY=your_key_here
SECRET_KEY=your_secret_key
ENCRYPTION_KEY=your_encryption_key
JWT_SECRET=your_jwt_secret
API_KEY_HASH_SALT=your_salt
```

#### Step 6: Deploy

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

#### Step 7: Configure Firewall

```bash
# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp  # SSH
ufw enable
```

#### Step 8: Set Up Domain (Optional)

1. Point your domain to server IP
2. Install Certbot for SSL:
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d yourdomain.com
```

Your app is now live at: `http://your_server_ip` or `https://yourdomain.com`

---

## ✈️ Option 2: Fly.io (Free Tier)

**Why Fly.io?**
- ✅ Free tier (3 VMs, 3GB storage)
- ✅ Global edge deployment
- ✅ Fast setup
- ✅ No credit card needed

### Quick Deploy

```bash
# Install Fly CLI (if not installed)
# Windows PowerShell:
iwr https://fly.io/install.ps1 -useb | iex

# Login
flyctl auth login

# Launch app
flyctl launch

# Set secrets
flyctl secrets set PORT=8000 BACKEND_HOST=0.0.0.0 BACKEND_PORT=8000 DEBUG_MODE=false
flyctl secrets set ALLOWED_ORIGINS=https://your-app.fly.dev

# Deploy
flyctl deploy
```

Your app will be live at: `https://privacy-browser-backend.fly.dev`

---

## 🚂 Option 3: Railway ($5/month)

**Why Railway?**
- ✅ Simple deployment
- ✅ Auto-deploy from GitHub
- ✅ $5/month (or free trial)
- ✅ Easy to use

### Deploy Steps

1. Sign up at [Railway](https://railway.app)
2. New Project → Deploy from GitHub
3. Select your repository
4. Railway auto-detects Docker
5. Set environment variables in dashboard
6. Deploy automatically

Your app will be live at: `https://your-app.up.railway.app`

---

## ☁️ Option 4: AWS/GCP/Azure (Advanced)

### AWS ECS/Fargate

1. Push Docker image to ECR
2. Create ECS cluster
3. Deploy as Fargate service
4. Configure load balancer

### Google Cloud Run

1. Build and push to GCR
2. Deploy to Cloud Run
3. Configure domain

### Azure Container Instances

1. Push to Azure Container Registry
2. Deploy to Container Instances
3. Configure public IP

---

## 🔧 VPS Deployment (Detailed)

### Complete Setup Script

Create `deploy-vps.sh`:

```bash
#!/bin/bash
# Complete VPS deployment script

echo "🚀 Starting Privacy Browser deployment..."

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Install Git
apt install git -y

# Clone repository
git clone https://github.com/Dakshkhod/privacy-browser.git
cd privacy-browser

# Create .env file (you'll need to edit this)
cd Backend
cat > .env << EOF
PORT=8000
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
DEBUG_MODE=false
ALLOWED_ORIGINS=http://$(curl -s ifconfig.me)
EOF

cd ..

# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# Configure firewall
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable

echo "✅ Deployment complete!"
echo "🌐 Your app is live at: http://$(curl -s ifconfig.me)"
```

### Run the script:

```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

---

## 🔒 Security Setup

### 1. Set Up SSL (Let's Encrypt - Free)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get certificate
certbot certonly --standalone -d yourdomain.com

# Auto-renewal
certbot renew --dry-run
```

### 2. Configure Firewall

```bash
# Only allow necessary ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 3. Secure SSH

```bash
# Disable root login
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Restart SSH
systemctl restart sshd
```

---

## 📊 Monitoring & Maintenance

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Restart Services

```bash
docker-compose -f docker-compose.prod.yml restart
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```

### Backup Data

```bash
# Backup volumes
docker run --rm -v privacy-browser_backend-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/backup.tar.gz /data
```

---

## 💰 Cost Comparison

| Option | Monthly Cost | Setup Time | Best For |
|--------|--------------|------------|----------|
| **DigitalOcean** | $5-12 | 30 min | Best value, full control |
| **Fly.io** | Free | 10 min | Quick start, free tier |
| **Railway** | $5 | 5 min | Easiest, auto-deploy |
| **AWS/GCP** | $5-20 | 1-2 hours | Enterprise, scalable |
| **Heroku** | $7 | 10 min | Traditional PaaS |

---

## ✅ Recommended Path

**For beginners**: Start with **Fly.io** (free, easy)
**For best value**: Use **DigitalOcean** ($5/month, full control)
**For simplicity**: Use **Railway** ($5/month, auto-deploy)

---

## 🆘 Troubleshooting

### Can't Access App

1. Check firewall: `ufw status`
2. Check Docker: `docker ps`
3. Check logs: `docker-compose logs`
4. Verify ports: `netstat -tulpn`

### App Crashes

1. Check logs: `docker-compose logs backend`
2. Check resources: `docker stats`
3. Verify environment variables
4. Check disk space: `df -h`

### SSL Issues

1. Verify domain DNS
2. Check Certbot: `certbot certificates`
3. Renew certificate: `certbot renew`

---

## 🎉 Next Steps

1. Choose your platform
2. Follow the deployment steps
3. Configure domain (optional)
4. Set up SSL (recommended)
5. Share your app URL!

Need help with a specific platform? Let me know!

