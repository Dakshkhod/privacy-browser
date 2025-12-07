# 🔧 Vercel Environment Variables Setup

Complete guide for setting up environment variables in Vercel for your Privacy Browser frontend.

## 📋 Required Environment Variables

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

### 1. Backend URL (Required)

**Variable Name:** `VITE_BACKEND_URL`  
**Value:** `https://privacybrowser-backend.onrender.com`

**Why:** This tells your frontend where to find the backend API. The `VITE_` prefix is required for Vite to expose it to the frontend code.

**For different environments:**
- **Production:** `https://privacybrowser-backend.onrender.com`
- **Preview:** `https://privacybrowser-backend.onrender.com` (or your preview backend)
- **Development:** Leave empty (will use `http://localhost:5001`)

### 2. Node Environment (Optional - Usually Auto-Set)

**Variable Name:** `NODE_ENV`  
**Value:** `production`

**Why:** Vercel usually sets this automatically, but you can set it explicitly if needed.

## 🚀 Quick Setup Steps

### Step 1: Go to Vercel Dashboard

1. Visit [vercel.com](https://vercel.com)
2. Select your project: `privacy-browser` (or your project name)
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Environment Variables

Click **"Add New"** and add:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_BACKEND_URL` | `https://privacybrowser-backend.onrender.com` | Production, Preview, Development |

**Or use the form:**
- **Key:** `VITE_BACKEND_URL`
- **Value:** `https://privacybrowser-backend.onrender.com`
- **Environment:** Select all (Production, Preview, Development)

### Step 3: Save and Redeploy

1. Click **"Save"**
2. Go to **Deployments** tab
3. Click **"Redeploy"** on the latest deployment
4. Or push a new commit to trigger auto-deploy

## 🔍 Verify Setup

After redeploying, check:

1. **Open your Vercel app:** `https://privacy-browser.vercel.app`
2. **Open Browser DevTools** → Console
3. **Check for errors:** Should not see CORS or connection errors
4. **Test the app:** Try analyzing a privacy policy

## 📝 Environment-Specific Values

### Production
```
VITE_BACKEND_URL=https://privacybrowser-backend.onrender.com
```

### Preview (if you have a preview backend)
```
VITE_BACKEND_URL=https://privacybrowser-backend.onrender.com
```

### Development (local)
Leave empty or set to:
```
VITE_BACKEND_URL=http://localhost:5001
```

## ⚠️ Important Notes

### Vite Environment Variables

- **Must start with `VITE_`**: Only variables prefixed with `VITE_` are exposed to the frontend
- **Build-time**: These are embedded at build time, not runtime
- **Public**: These variables are visible in the browser, so don't put secrets here

### After Changing Variables

1. **Redeploy required**: Environment variables are embedded at build time
2. **New deployment**: Push a commit or manually redeploy
3. **Cache**: Clear browser cache if testing locally

## 🔐 Security Notes

✅ **Safe to expose:**
- Backend URLs (public endpoints)
- Public API keys (if any)
- Feature flags

❌ **Never expose:**
- Secret keys
- Private API keys
- Database credentials
- Authentication tokens

## 🐛 Troubleshooting

### Frontend Can't Connect to Backend

1. **Check CORS**: Verify `ALLOWED_ORIGINS` in Render includes your Vercel URL
2. **Check URL**: Verify `VITE_BACKEND_URL` is correct
3. **Check Network**: Open DevTools → Network tab, look for failed requests
4. **Check Console**: Look for CORS or connection errors

### Environment Variable Not Working

1. **Check prefix**: Must be `VITE_` for Vite
2. **Redeploy**: Variables are embedded at build time
3. **Check spelling**: Variable names are case-sensitive
4. **Check environment**: Make sure variable is set for the right environment

### CORS Errors

1. **Backend CORS**: Update `ALLOWED_ORIGINS` in Render:
   ```
   https://privacy-browser.vercel.app
   ```
   (No trailing slash!)

2. **Redeploy backend**: After updating CORS, redeploy the Render service

## ✅ Checklist

- [ ] Added `VITE_BACKEND_URL` in Vercel
- [ ] Set value to `https://privacybrowser-backend.onrender.com`
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Saved the variable
- [ ] Redeployed the frontend
- [ ] Tested the app
- [ ] Verified backend connection works
- [ ] Updated Render `ALLOWED_ORIGINS` with Vercel URL (no trailing slash)

## 📞 Quick Reference

**Vercel Dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard)  
**Your Backend:** `https://privacybrowser-backend.onrender.com`  
**Your Frontend:** `https://privacy-browser.vercel.app`

---

**That's it!** Your frontend should now connect to your Render backend. 🚀

