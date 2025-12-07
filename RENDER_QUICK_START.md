# 🚀 Quick Start: Deploy on Render (5 Minutes)

## Step 1: Sign Up
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Connect your GitHub account

## Step 2: Deploy Backend

1. Click **"New"** → **"Web Service"**
2. Connect your repo: `Dakshkhod/privacy-browser`
3. Configure:
   - **Name**: `privacy-browser-backend`
   - **Root Directory**: `Backend`
   - **Environment**: `Python 3`
   - **Build Command**: 
     ```bash
     pip install --upgrade pip && pip install -r requirements.txt && python -m spacy download en_core_web_sm
     ```
   - **Start Command**: 
     ```bash
     gunicorn -c gunicorn.conf.py main_optimized:app
     ```
   - **Plan**: Free

4. **Add Environment Variables**:
   - `PORT` = `10000`
   - `BACKEND_HOST` = `0.0.0.0`
   - `BACKEND_PORT` = `10000`
   - `DEBUG_MODE` = `false`
   - `GROQ_API_KEY` = `your_api_key_here`
   - `ALLOWED_ORIGINS` = `https://privacy-browser-frontend.onrender.com` (update after frontend deploy)

5. Click **"Create Web Service"**

**Backend URL**: `https://privacy-browser-backend.onrender.com`

## Step 3: Deploy Frontend

1. Click **"New"** → **"Static Site"**
2. Connect your repo: `Dakshkhod/privacy-browser`
3. Configure:
   - **Name**: `privacy-browser-frontend`
   - **Root Directory**: `Frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Plan**: Free

4. Click **"Create Static Site"**

**Frontend URL**: `https://privacy-browser-frontend.onrender.com`

## Step 4: Update Frontend Config

1. Edit `Frontend/src/config.js`:
   ```javascript
   BACKEND_URL: process.env.NODE_ENV === 'production'
     ? 'https://privacy-browser-backend.onrender.com'
     : 'http://localhost:5001',
   ```

2. Commit and push:
   ```bash
   git add Frontend/src/config.js
   git commit -m "Update backend URL for Render"
   git push origin main
   ```

3. Render will auto-redeploy frontend

## Step 5: Update Backend CORS

1. Go to Backend service → Environment
2. Update `ALLOWED_ORIGINS`:
   ```
   https://privacy-browser-frontend.onrender.com
   ```
3. Save (auto-redeploys)

## ✅ Done!

Your app is live:
- **Backend**: `https://privacy-browser-backend.onrender.com`
- **Frontend**: `https://privacy-browser-frontend.onrender.com`

## 📝 Or Use Blueprint (Easier!)

1. Click **"New"** → **"Blueprint"**
2. Connect repo: `Dakshkhod/privacy-browser`
3. Render auto-detects `render.yaml`
4. Add environment variables in dashboard
5. Click **"Apply"**

Both services deploy automatically!

---

**Need help?** See `DEPLOY_RENDER.md` for detailed guide.

