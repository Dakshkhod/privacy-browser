# 🔧 Fix Render Start Command Error

## ❌ Current Error

```
==> Running 'cd Backend && python start_simple.py'
bash: line 1: cd: Backend: No such file or directory
```

## ✅ Solution

Your Render service has the wrong start command. Here's how to fix it:

### Step 1: Go to Render Dashboard

1. Go to [render.com](https://render.com)
2. Click on your service: **`PrivacyBrowser-backend`**
3. Go to **Settings** tab

### Step 2: Update Start Command

Find the **"Start Command"** field and update it to:

**Option A (if Root Directory is set to `Backend`):**
```bash
gunicorn -c gunicorn.conf.py main_optimized:app
```

**Option B (if Root Directory is NOT set):**
```bash
cd Backend && gunicorn -c gunicorn.conf.py main_optimized:app
```

### Step 3: Verify Root Directory

While you're in Settings, check **"Root Directory"**:
- Should be: `Backend` (if set, use Option A above)
- Or: Leave empty (if empty, use Option B above)

### Step 4: Verify Build Command

Make sure **"Build Command"** is:
```bash
pip install --upgrade pip && pip install -r requirements.txt && python -m spacy download en_core_web_sm
```

### Step 5: Save and Redeploy

1. Click **"Save Changes"** at the bottom
2. Render will automatically redeploy
3. Or go to **"Manual Deploy"** → **"Deploy latest commit"**

## 📋 Complete Settings Checklist

Make sure these are correct in Render Dashboard → Settings:

| Setting | Value |
|---------|-------|
| **Root Directory** | `Backend` (or leave empty) |
| **Environment** | `Python 3` |
| **Build Command** | `pip install --upgrade pip && pip install -r requirements.txt && python -m spacy download en_core_web_sm` |
| **Start Command** | `gunicorn -c gunicorn.conf.py main_optimized:app` (if Root Directory = Backend)<br>OR<br>`cd Backend && gunicorn -c gunicorn.conf.py main_optimized:app` (if Root Directory is empty) |

## 🔍 Verify After Fix

After updating and redeploying, check the logs. You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:10000
```

Instead of the error about `start_simple.py`.

## ⚠️ Why This Happened

The service was probably created with an old start command (`start_simple.py`) that doesn't exist in your codebase. The correct command uses `gunicorn` which is the production server.

---

**After fixing, your deployment should work!** 🚀

