# Deploy Privacy Browser on Render 🚀

Complete guide to deploy your Privacy Browser app on Render for public access.

## 📋 Prerequisites

1. **GitHub Account** - Your code should be on GitHub
2. **Render Account** - Sign up at [render.com](https://render.com) (free tier available)
3. **API Keys** - You'll need your GROQ_API_KEY (or OPENAI_API_KEY)

## 🎯 Quick Deploy (5 minutes)

### Step 1: Sign Up on Render

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (recommended)
3. Connect your GitHub account

### Step 2: Deploy Backend

1. **New → Web Service**
2. **Connect Repository**: Select `Dakshkhod/privacy-browser`
3. **Configure Service**:
   - **Name**: `privacy-browser-backend`
   - **Region**: Choose closest to you (Oregon recommended)
   - **Branch**: `main`
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
   - **Plan**: Free (or Starter for better performance)

4. **Environment Variables** (Add these in Render dashboard):
   ```
   PORT=10000
   BACKEND_HOST=0.0.0.0
   BACKEND_PORT=10000
   DEBUG_MODE=false
   LOG_LEVEL=INFO
   GROQ_API_KEY=your_groq_api_key_here
   ALLOWED_ORIGINS=https://privacy-browser-frontend.onrender.com,https://your-frontend-url.onrender.com
   ```

5. **Click "Create Web Service"**

6. **Wait for deployment** (5-10 minutes first time)

Your backend will be live at: `https://privacy-browser-backend.onrender.com`

### Step 3: Deploy Frontend

1. **New → Static Site**
2. **Connect Repository**: Select `Dakshkhod/privacy-browser`
3. **Configure**:
   - **Name**: `privacy-browser-frontend`
   - **Branch**: `main`
   - **Root Directory**: `Frontend`
   - **Build Command**: 
     ```bash
     npm install && npm run build
     ```
   - **Publish Directory**: `dist`
   - **Plan**: Free

4. **Environment Variables** (if needed):
   ```
   NODE_ENV=production
   ```

5. **Click "Create Static Site"**

6. **Update Frontend Config**:
   - After backend is deployed, update `Frontend/src/config.js`:
   ```javascript
   BACKEND_URL: process.env.NODE_ENV === 'production'
     ? 'https://privacy-browser-backend.onrender.com'
     : 'http://localhost:5001',
   ```
   - Commit and push the change
   - Render will auto-redeploy

Your frontend will be live at: `https://privacy-browser-frontend.onrender.com`

## 🔧 Using render.yaml (Recommended)

If you've already created `render.yaml` in your repo:

1. **New → Blueprint**
2. **Connect Repository**: Select `Dakshkhod/privacy-browser`
3. **Render will auto-detect** `render.yaml`
4. **Review configuration** and click "Apply"
5. **Set Environment Variables** in the dashboard for each service

This deploys both backend and frontend automatically!

## 🔑 Required Environment Variables

### Backend Service

Add these in Render Dashboard → Your Service → Environment:

| Variable | Value | Required |
|----------|-------|----------|
| `PORT` | `10000` | ✅ Yes |
| `BACKEND_HOST` | `0.0.0.0` | ✅ Yes |
| `BACKEND_PORT` | `10000` | ✅ Yes |
| `DEBUG_MODE` | `false` | ✅ Yes |
| `LOG_LEVEL` | `INFO` | ✅ Yes |
| `GROQ_API_KEY` | Your API key | ✅ Yes |
| `ALLOWED_ORIGINS` | Your frontend URL | ✅ Yes |

### Optional (for enhanced security):

| Variable | Value | Required |
|----------|-------|----------|
| `SECRET_KEY` | Random string | ⚠️ Recommended |
| `ENCRYPTION_KEY` | Random string | ⚠️ Recommended |
| `JWT_SECRET` | Random string | ⚠️ Recommended |
| `API_KEY_HASH_SALT` | Random string | ⚠️ Recommended |

**Generate secrets:**
```bash
python Backend/setup_environment.py
```

## 🌐 Update CORS Settings

After deploying, update `ALLOWED_ORIGINS` in backend:

```
ALLOWED_ORIGINS=https://privacy-browser-frontend.onrender.com,https://your-custom-domain.com
```

## 📝 Update Frontend Config

After backend deployment, update `Frontend/src/config.js`:

```javascript
const config = {
  BACKEND_URL: process.env.NODE_ENV === 'production'
    ? 'https://privacy-browser-backend.onrender.com'  // Your Render backend URL
    : 'http://localhost:5001',
  // ... rest of config
};
```

Then commit and push:
```bash
git add Frontend/src/config.js
git commit -m "Update backend URL for Render deployment"
git push origin main
```

Render will auto-redeploy your frontend.

## 🔍 Verify Deployment

### Check Backend

1. Visit: `https://privacy-browser-backend.onrender.com/health`
2. Should return: `{"status":"ok"}`

### Check Frontend

1. Visit: `https://privacy-browser-frontend.onrender.com`
2. Try analyzing a privacy policy
3. Check browser console for errors

## ⚠️ Important Notes

### Free Tier Limitations

- **Cold Starts**: Free tier services spin down after 15 minutes of inactivity
- **First Request**: May take 30-60 seconds to wake up
- **Performance**: Slower than paid tiers
- **Build Time**: Limited to 45 minutes

### Upgrade to Starter ($7/month)

For better performance:
- No cold starts
- Faster response times
- More resources
- Better reliability

### Custom Domain

1. Go to your service → Settings → Custom Domain
2. Add your domain
3. Update DNS records as shown
4. SSL is automatic

## 🐛 Troubleshooting

### Backend Won't Start

1. **Check Logs**: Render Dashboard → Your Service → Logs
2. **Common Issues**:
   - Missing environment variables
   - Port mismatch (should be 10000)
   - Build errors
   - Missing dependencies

### Frontend Can't Connect

1. **Check CORS**: Verify `ALLOWED_ORIGINS` includes frontend URL
2. **Check Backend URL**: Verify `config.js` has correct backend URL
3. **Check Network**: Open browser DevTools → Network tab

### Build Fails

1. **Check Requirements**: Ensure `requirements.txt` is correct
2. **Check Build Logs**: Look for specific error messages
3. **Python Version**: Render uses Python 3.11 by default

### Slow Performance

- **Free Tier**: Normal for free tier (cold starts)
- **Upgrade**: Consider Starter plan ($7/month)
- **Caching**: Your app already has caching built-in

## 📊 Monitoring

### View Logs

1. Render Dashboard → Your Service → Logs
2. Real-time logs available
3. Download logs for analysis

### Health Checks

- Backend: `https://your-backend.onrender.com/health`
- Should return: `{"status":"ok"}`

## 🔄 Auto-Deploy

Render automatically deploys when you:
- Push to `main` branch
- Merge pull requests
- Manually trigger from dashboard

## 🔐 Security Checklist

- [ ] All API keys in environment variables (not in code)
- [ ] `DEBUG_MODE=false` in production
- [ ] CORS properly configured
- [ ] HTTPS enabled (automatic on Render)
- [ ] Secrets not committed to Git

## 🎉 Success!

Your app is now live and accessible to everyone!

**Backend**: `https://privacy-browser-backend.onrender.com`
**Frontend**: `https://privacy-browser-frontend.onrender.com`

Share these URLs with others!

## 📞 Need Help?

1. Check Render documentation: [render.com/docs](https://render.com/docs)
2. Check service logs in Render dashboard
3. Verify environment variables
4. Test endpoints manually

---

**Next Steps:**
- Set up custom domain (optional)
- Upgrade to Starter plan for better performance (optional)
- Monitor usage and logs
- Share your app with others! 🚀

