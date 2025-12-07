# Deploy to Fly.io NOW (Free Forever) ✈️

## 🚀 Step-by-Step (5 minutes)

### Step 1: Install Fly CLI

**Open PowerShell as Administrator** and run:

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Or if that doesn't work, use:**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

After installation, **close and reopen your terminal**.

### Step 2: Login

```bash
flyctl auth login
```

This opens your browser. Sign up for free (no credit card needed).

### Step 3: Deploy

```bash
# Make sure you're in the project root
cd "D:\Privacy browser"

# Launch (this will create/update fly.toml)
flyctl launch

# When prompted:
# - App name: privacy-browser-backend (or just press Enter)
# - Region: iad (or choose closest: iad=US East, lhr=Europe, nrt=Asia)
# - PostgreSQL: No
# - Redis: No
```

### Step 4: Set Secrets (Environment Variables)

```bash
# Required
flyctl secrets set PORT=8000 BACKEND_HOST=0.0.0.0 BACKEND_PORT=8000 DEBUG_MODE=false

# Optional: Get free Groq API key from https://console.groq.com
flyctl secrets set GROQ_API_KEY=your_groq_key_here

# Security (you can generate these or use defaults - app will work)
flyctl secrets set SECRET_KEY=default-secret-key-for-development-only-change-in-production
flyctl secrets set ENCRYPTION_KEY=default-encryption-key-for-development-only-change-in-production
flyctl secrets set JWT_SECRET=default-jwt-secret-for-development-only-change-in-production
flyctl secrets set API_KEY_HASH_SALT=default-salt-for-development-only-change-in-production

# CORS (update with your frontend URL)
flyctl secrets set ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend-domain.com
```

### Step 5: Deploy Again

```bash
flyctl deploy
```

Wait 2-4 minutes. You'll get a URL like:
```
https://privacy-browser-backend.fly.dev
```

### Step 6: Test

```bash
# Test health endpoint
curl https://privacy-browser-backend.fly.dev/

# Or open in browser
# https://privacy-browser-backend.fly.dev/
```

### Step 7: Update Frontend

Edit `Frontend/src/config.js`:
```javascript
BACKEND_URL: process.env.NODE_ENV === 'production'
  ? 'https://privacy-browser-backend.fly.dev'  // Your Fly.io URL
  : 'http://localhost:5001',
```

## ✅ Done!

Your backend is now live on Fly.io - **free forever**!

## 💰 Free Tier Includes

- ✅ 3 shared-cpu VMs (256MB RAM each)
- ✅ 3GB persistent storage
- ✅ 160GB data transfer/month
- ✅ No credit card required
- ✅ No time limits
- ✅ Global edge deployment

## 🔧 Useful Commands

```bash
# View logs
flyctl logs

# Check status
flyctl status

# Open dashboard
flyctl dashboard

# View secrets
flyctl secrets list

# Restart app
flyctl apps restart privacy-browser-backend
```

## 🆘 Troubleshooting

**Can't install Fly CLI?**
- Make sure PowerShell is run as Administrator
- Try the alternative install method above

**Deploy fails?**
```bash
# Check logs
flyctl logs

# Rebuild without cache
flyctl deploy --no-cache
```

**App not starting?**
```bash
# Check secrets are set
flyctl secrets list

# Check status
flyctl status
```

## 🌍 Best Regions

- `iad` - Washington, D.C. (US East) - **Recommended for US**
- `lhr` - London (Europe)
- `nrt` - Tokyo (Asia)
- `syd` - Sydney (Australia)

Choose the one closest to your users!

