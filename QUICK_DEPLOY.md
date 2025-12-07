# Quick Deploy to Fly.io - Windows Git Bash

## ✅ Fly CLI is Installed!

Fly CLI is installed at: `C:\Users\DK\.fly\bin\flyctl.exe`

## 🚀 Quick Start

### Option 1: Use Full Path (Easiest)

```bash
# Login
/c/Users/DK/.fly/bin/flyctl.exe auth login

# Launch app
/c/Users/DK/.fly/bin/flyctl.exe launch

# Set secrets
/c/Users/DK/.fly/bin/flyctl.exe secrets set PORT=8000 BACKEND_HOST=0.0.0.0 BACKEND_PORT=8000 DEBUG_MODE=false

# Deploy
/c/Users/DK/.fly/bin/flyctl.exe deploy
```

### Option 2: Add to PATH (Current Session)

```bash
# Add to PATH for this session
export PATH="$PATH:/c/Users/DK/.fly/bin"

# Now you can use flyctl directly
flyctl.exe auth login
flyctl.exe launch
flyctl.exe deploy
```

### Option 3: Create Alias (Current Session)

```bash
# Create alias
alias flyctl='/c/Users/DK/.fly/bin/flyctl.exe'

# Use it
flyctl auth login
flyctl launch
flyctl deploy
```

### Option 4: Use Deploy Script

```bash
# Run the deploy script
bash deploy_fly.sh
```

## 📝 Step-by-Step Deployment

### 1. Login to Fly.io

```bash
/c/Users/DK/.fly/bin/flyctl.exe auth login
```

This will open your browser. Sign up/login (free, no credit card).

### 2. Launch Your App

```bash
/c/Users/DK/.fly/bin/flyctl.exe launch
```

When prompted:
- **App name**: `privacy-browser-backend` (or press Enter)
- **Region**: `iad` (US East) or choose closest
- **PostgreSQL**: No
- **Redis**: No

### 3. Set Environment Variables

```bash
# Required
/c/Users/DK/.fly/bin/flyctl.exe secrets set PORT=8000 BACKEND_HOST=0.0.0.0 BACKEND_PORT=8000 DEBUG_MODE=false

# Optional: Groq API key (get from https://console.groq.com)
/c/Users/DK/.fly/bin/flyctl.exe secrets set GROQ_API_KEY=your_key_here

# Security (defaults - app will work)
/c/Users/DK/.fly/bin/flyctl.exe secrets set SECRET_KEY=default-secret-key-for-development-only-change-in-production
/c/Users/DK/.fly/bin/flyctl.exe secrets set ENCRYPTION_KEY=default-encryption-key-for-development-only-change-in-production
/c/Users/DK/.fly/bin/flyctl.exe secrets set JWT_SECRET=default-jwt-secret-for-development-only-change-in-production
/c/Users/DK/.fly/bin/flyctl.exe secrets set API_KEY_HASH_SALT=default-salt-for-development-only-change-in-production

# CORS
/c/Users/DK/.fly/bin/flyctl.exe secrets set ALLOWED_ORIGINS=http://localhost:5173
```

### 4. Deploy

```bash
/c/Users/DK/.fly/bin/flyctl.exe deploy
```

Wait 2-4 minutes. You'll get a URL like:
```
https://privacy-browser-backend.fly.dev
```

### 5. Test

```bash
# Test health endpoint
curl https://privacy-browser-backend.fly.dev/

# Or open in browser
```

### 6. Update Frontend

Edit `Frontend/src/config.js`:
```javascript
BACKEND_URL: process.env.NODE_ENV === 'production'
  ? 'https://privacy-browser-backend.fly.dev'  // Your Fly.io URL
  : 'http://localhost:5001',
```

## 🔧 Useful Commands

```bash
# View logs
/c/Users/DK/.fly/bin/flyctl.exe logs

# Check status
/c/Users/DK/.fly/bin/flyctl.exe status

# View secrets
/c/Users/DK/.fly/bin/flyctl.exe secrets list

# Open dashboard
/c/Users/DK/.fly/bin/flyctl.exe dashboard
```

## 💡 Permanent PATH Setup (Optional)

To make `flyctl` available in all terminals, add to your `~/.bashrc`:

```bash
# Add Fly CLI to PATH
export PATH="$PATH:/c/Users/DK/.fly/bin"
```

Then reload:
```bash
source ~/.bashrc
```

## ✅ Done!

Your backend will be live on Fly.io - **free forever**!

