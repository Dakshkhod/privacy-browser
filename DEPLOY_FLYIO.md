# Deploy Backend to Fly.io ✈️

**Fly.io offers global edge deployment with excellent performance and speed.**

## 🚀 Quick Deployment (10 minutes)

### Step 1: Install Fly CLI

```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Mac
curl -L https://fly.io/install.sh | sh

# Linux
curl -L https://fly.io/install.sh | sh
```

### Step 2: Login to Fly.io

```bash
flyctl auth login
```

### Step 3: Initialize Project

```bash
# In project root
flyctl launch

# Follow prompts:
# - App name: privacy-browser-backend (or your choice)
# - Region: Choose closest to you (e.g., iad, ord, dfw)
# - PostgreSQL: No (unless you need it)
# - Redis: No (unless you need it)
```

### Step 4: Configure App

The `fly.toml` file is already created. Update if needed:

```toml
app = "privacy-browser-backend"
primary_region = "iad"  # Your preferred region
```

### Step 5: Set Environment Variables

```bash
# Required
flyctl secrets set PORT=8000
flyctl secrets set BACKEND_HOST=0.0.0.0
flyctl secrets set BACKEND_PORT=8000
flyctl secrets set DEBUG_MODE=false

# Optional (AI features)
flyctl secrets set GROQ_API_KEY=your_groq_api_key
flyctl secrets set OPENAI_API_KEY=your_openai_api_key

# Security (generate using Backend/setup_environment.py)
flyctl secrets set SECRET_KEY=your_64_char_secret_key
flyctl secrets set ENCRYPTION_KEY=your_encryption_key
flyctl secrets set JWT_SECRET=your_64_char_jwt_secret
flyctl secrets set API_KEY_HASH_SALT=your_salt_value

# CORS
flyctl secrets set ALLOWED_ORIGINS=https://your-frontend-domain.com
```

### Step 6: Deploy

```bash
flyctl deploy
```

### Step 7: Get Your URL

After deployment:
```
https://privacy-browser-backend.fly.dev
```

### Step 8: Update Frontend Config

Update `Frontend/src/config.js`:
```javascript
const config = {
  BACKEND_URL: process.env.NODE_ENV === 'production'
    ? 'https://privacy-browser-backend.fly.dev'  // Your Fly.io URL
    : 'http://localhost:5001',
  // ...
};
```

## ⚡ Why Fly.io is Better

- **Global edge deployment**: Fast worldwide
- **Excellent performance**: Better than Render/Railway
- **Fast deploys**: 2-4 minutes
- **No cold starts**: Services stay warm
- **Free tier**: 3 shared-cpu VMs, 3GB storage
- **Auto-scaling**: Scales based on traffic
- **Built-in monitoring**: Metrics and logs

## 💰 Pricing

- **Free Tier**: 
  - 3 shared-cpu VMs
  - 3GB persistent storage
  - 160GB outbound data transfer
  - Perfect for small apps

- **Paid Plans**: Start at $1.94/month per VM

## 🔧 Troubleshooting

### Build Fails
- Check `fly.toml` configuration
- Verify Python version (3.11)
- Review build logs: `flyctl logs`

### App Not Starting
- Check secrets: `flyctl secrets list`
- Verify PORT is set
- Review logs: `flyctl logs`

### Performance Issues
- Check VM resources: `flyctl status`
- Scale up if needed: `flyctl scale count 2`

## 📊 Monitoring

- **Logs**: `flyctl logs` or dashboard
- **Metrics**: Available in dashboard
- **Status**: `flyctl status`

## 🌍 Regions

Choose closest region for better performance:
- `iad` - Washington, D.C.
- `ord` - Chicago
- `dfw` - Dallas
- `lax` - Los Angeles
- `lhr` - London
- `nrt` - Tokyo
- `syd` - Sydney

## ✅ Post-Deployment

- [ ] Backend accessible at Fly.io URL
- [ ] Health check works: `https://your-app.fly.dev/`
- [ ] Environment variables set
- [ ] Frontend config updated
- [ ] Test API endpoints

## 🆘 Need Help?

- Fly.io Docs: https://fly.io/docs
- Fly.io Community: https://community.fly.io
- Check logs: `flyctl logs`

