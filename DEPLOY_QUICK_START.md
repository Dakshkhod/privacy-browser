# Quick Deployment Guide - Fly.io (Free Tier) ✈️

## 🚀 Fastest Way to Deploy (5 minutes)

### Step 1: Install Fly CLI

**Windows (PowerShell as Administrator):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Mac/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

After installation, restart your terminal.

### Step 2: Login to Fly.io

```bash
flyctl auth login
```

This will open your browser to sign up/login (free account).

### Step 3: Deploy Your Backend

```bash
# Navigate to project root
cd "D:\Privacy browser"

# Launch the app (creates fly.toml if needed)
flyctl launch

# Follow the prompts:
# - App name: privacy-browser-backend (or press Enter for auto-generated)
# - Region: Choose closest (e.g., iad for US East, lhr for Europe)
# - PostgreSQL: No
# - Redis: No
```

### Step 4: Set Environment Variables

```bash
# Required variables
flyctl secrets set PORT=8000
flyctl secrets set BACKEND_HOST=0.0.0.0
flyctl secrets set BACKEND_PORT=8000
flyctl secrets set DEBUG_MODE=false

# Optional: AI features (get from https://console.groq.com)
flyctl secrets set GROQ_API_KEY=your_groq_api_key_here

# Security keys (generate using Backend/setup_environment.py or use defaults)
flyctl secrets set SECRET_KEY=your_64_char_secret_key
flyctl secrets set ENCRYPTION_KEY=your_encryption_key
flyctl secrets set JWT_SECRET=your_64_char_jwt_secret
flyctl secrets set API_KEY_HASH_SALT=your_salt_value

# CORS (update with your frontend URL)
flyctl secrets set ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:5173
```

### Step 5: Deploy

```bash
flyctl deploy
```

Wait 2-4 minutes for deployment to complete.

### Step 6: Get Your URL

After deployment, you'll get a URL like:
```
https://privacy-browser-backend.fly.dev
```

### Step 7: Update Frontend Config

Update `Frontend/src/config.js`:
```javascript
const config = {
  BACKEND_URL: process.env.NODE_ENV === 'production'
    ? 'https://privacy-browser-backend.fly.dev'  // Your Fly.io URL
    : 'http://localhost:5001',
  // ...
};
```

## ✅ Verify Deployment

Test your backend:
```bash
# Check health
curl https://privacy-browser-backend.fly.dev/

# Check logs
flyctl logs
```

## 💰 Fly.io Free Tier

- **3 shared-cpu VMs** (256MB RAM each)
- **3GB persistent storage**
- **160GB outbound data transfer/month**
- **No credit card required**
- **No time limits**

Perfect for small to medium apps!

## 🔧 Troubleshooting

### Build Fails
```bash
# Check logs
flyctl logs

# Rebuild
flyctl deploy --no-cache
```

### App Not Starting
```bash
# Check status
flyctl status

# View logs
flyctl logs

# Check secrets
flyctl secrets list
```

### Need More Resources
```bash
# Scale up (paid)
flyctl scale count 2
flyctl scale vm shared-cpu-2x
```

## 📊 Monitor Your App

```bash
# View logs in real-time
flyctl logs

# Check app status
flyctl status

# View metrics
flyctl dashboard
```

## 🌍 Choose Best Region

- `iad` - Washington, D.C. (US East)
- `ord` - Chicago (US Central)
- `dfw` - Dallas (US South)
- `lax` - Los Angeles (US West)
- `lhr` - London (Europe)
- `nrt` - Tokyo (Asia)
- `syd` - Sydney (Australia)

Choose the region closest to your users!

## 🆘 Need Help?

- Fly.io Docs: https://fly.io/docs
- Community: https://community.fly.io
- Support: Available in dashboard

