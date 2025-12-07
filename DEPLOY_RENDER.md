# Deploy Backend to Render

## 🚀 Quick Deployment Guide

### Prerequisites
- GitHub account
- Render account (free tier available)
- Environment variables ready (API keys, secrets)

### Step 1: Prepare Your Repository

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

### Step 2: Deploy on Render

1. **Go to [Render Dashboard](https://dashboard.render.com/)**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service**:
   - **Name**: `privacy-browser-backend`
   - **Environment**: `Python 3`
   - **Build Command**: 
     ```bash
     pip install --upgrade pip setuptools wheel && cd Backend && pip install -r requirements.txt && python -m spacy download en_core_web_sm --quiet || echo "spaCy optional"
     ```
   - **Start Command**:
     ```bash
     cd Backend && python -c "import sys; sys.path.insert(0, '.'); from main_optimized import app; import uvicorn; uvicorn.run(app, host='0.0.0.0', port=$PORT)"
     ```
   - **Plan**: Free (or choose paid for better performance)

### Step 3: Set Environment Variables

In Render dashboard, go to **Environment** tab and add:

**Required:**
- `PORT` = `8000` (auto-set by Render, but good to have)
- `BACKEND_HOST` = `0.0.0.0`
- `BACKEND_PORT` = `8000`
- `DEBUG_MODE` = `false`

**Optional (for AI features):**
- `GROQ_API_KEY` = `your_groq_api_key_here`
- `OPENAI_API_KEY` = `your_openai_api_key_here` (if using OpenAI)

**Security (generate using `Backend/setup_environment.py`):**
- `SECRET_KEY` = `your_64_char_secret_key`
- `ENCRYPTION_KEY` = `your_encryption_key`
- `JWT_SECRET` = `your_64_char_jwt_secret`
- `API_KEY_HASH_SALT` = `your_salt_value`

**CORS:**
- `ALLOWED_ORIGINS` = `https://your-frontend-domain.com,https://www.your-frontend-domain.com`

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for build to complete (5-10 minutes)
3. Your backend will be available at: `https://privacy-browser-backend.onrender.com`

### Step 5: Update Frontend Config

Update `Frontend/src/config.js`:
```javascript
const config = {
  BACKEND_URL: process.env.NODE_ENV === 'production'
    ? 'https://privacy-browser-backend.onrender.com'  // Your Render URL
    : 'http://localhost:5001',
  // ...
};
```

### Alternative: Use render.yaml (Auto-Deploy)

If you have `render.yaml` in your repo root, Render will auto-detect it:

1. Push `render.yaml` to your repo
2. In Render dashboard, select "Apply Render Blueprint"
3. Render will automatically configure everything

## 🔧 Troubleshooting

### Build Fails
- Check Python version (should be 3.11)
- Verify `requirements.txt` exists in `Backend/`
- Check build logs for specific errors

### App Crashes
- Check environment variables are set
- Verify `PORT` is set (Render sets this automatically)
- Check logs in Render dashboard

### Slow Cold Starts
- Free tier has slower cold starts (~30-60s)
- Upgrade to paid plan for faster starts
- Use health checks to keep service warm

### spaCy Model Issues
- spaCy download is optional (app works without it)
- If download fails, app continues with reduced NLP features

## 📊 Monitoring

- **Logs**: Available in Render dashboard
- **Metrics**: View in Render dashboard
- **Health Check**: Configured at `/` endpoint

## 🔒 Security Notes

- Never commit `.env` files
- Use Render's environment variables for secrets
- Enable HTTPS (automatic on Render)
- Set proper `ALLOWED_ORIGINS` for CORS

## 💰 Pricing

- **Free Tier**: 
  - 750 hours/month
  - Spins down after 15 min inactivity
  - ~30-60s cold start
  
- **Starter ($7/month)**:
  - Always on
  - Faster cold starts
  - Better performance

## ✅ Post-Deployment Checklist

- [ ] Backend is accessible at Render URL
- [ ] Health check endpoint works: `https://your-backend.onrender.com/`
- [ ] Environment variables are set
- [ ] Frontend config updated with backend URL
- [ ] CORS configured correctly
- [ ] Test API endpoints work

## 🆘 Need Help?

- Render Docs: https://render.com/docs
- Render Support: Available in dashboard
- Check application logs in Render dashboard

