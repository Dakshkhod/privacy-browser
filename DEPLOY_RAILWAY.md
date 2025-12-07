# Deploy Backend to Railway 🚂

**Railway is faster than Render with instant deploys and better performance.**

## 🚀 Quick Deployment (5 minutes)

### Step 1: Install Railway CLI (Optional but Recommended)

```bash
# Windows (PowerShell)
iwr https://railway.app/install.sh | iex

# Mac/Linux
curl -fsSL https://railway.app/install.sh | sh
```

### Step 2: Deploy via GitHub (Easiest)

1. **Go to [Railway Dashboard](https://railway.app/)**
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Choose your repository**
5. **Railway will auto-detect the configuration**

### Step 3: Configure Environment Variables

In Railway dashboard, go to **Variables** tab:

**Required:**
```
PORT=8000
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
DEBUG_MODE=false
```

**Optional (for AI features):**
```
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
```

**Security (generate using `Backend/setup_environment.py`):**
```
SECRET_KEY=your_64_char_secret_key
ENCRYPTION_KEY=your_encryption_key
JWT_SECRET=your_64_char_jwt_secret
API_KEY_HASH_SALT=your_salt_value
```

**CORS:**
```
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

### Step 4: Deploy via CLI (Alternative)

```bash
# Login
railway login

# Initialize project
railway init

# Link to existing project (or create new)
railway link

# Set environment variables
railway variables set PORT=8000
railway variables set BACKEND_HOST=0.0.0.0
railway variables set DEBUG_MODE=false

# Deploy
railway up
```

### Step 5: Get Your URL

After deployment, Railway provides a URL like:
```
https://privacy-browser-backend-production.up.railway.app
```

### Step 6: Update Frontend Config

Update `Frontend/src/config.js`:
```javascript
const config = {
  BACKEND_URL: process.env.NODE_ENV === 'production'
    ? 'https://privacy-browser-backend-production.up.railway.app'  // Your Railway URL
    : 'http://localhost:5001',
  // ...
};
```

## ⚡ Why Railway is Better

- **Faster deploys**: 2-3 minutes vs 5-10 on Render
- **Better performance**: More CPU/RAM on free tier
- **Instant cold starts**: No 30-60s wait time
- **Better monitoring**: Real-time logs and metrics
- **Custom domains**: Free SSL included
- **No sleep**: Services stay awake longer

## 💰 Pricing

- **Free Tier**: $5 credit/month (usually enough for small apps)
- **Hobby ($5/month)**: More resources, always-on
- **Pro ($20/month)**: Production-ready

## 🔧 Troubleshooting

### Build Fails
- Check Python version (3.11)
- Verify `requirements.txt` exists
- Check build logs in Railway dashboard

### App Not Starting
- Verify `PORT` environment variable
- Check start command in `railway.json`
- Review logs: `railway logs`

### Slow Performance
- Upgrade to Hobby plan for better resources
- Check resource usage in dashboard

## 📊 Monitoring

- **Logs**: `railway logs` or dashboard
- **Metrics**: Available in dashboard
- **Health**: Configured at `/` endpoint

## ✅ Post-Deployment

- [ ] Backend accessible at Railway URL
- [ ] Health check works: `https://your-app.up.railway.app/`
- [ ] Environment variables set
- [ ] Frontend config updated
- [ ] Test API endpoints

## 🆘 Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check logs: `railway logs`

