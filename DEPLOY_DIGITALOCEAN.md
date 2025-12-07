# Deploy Backend to DigitalOcean App Platform 🌊

**DigitalOcean App Platform offers managed deployment with excellent performance.**

## 🚀 Quick Deployment (15 minutes)

### Step 1: Create app.yaml

Create `app.yaml` in project root (already created):

```yaml
name: privacy-browser-backend
services:
- name: backend
  source_dir: Backend
  github:
    repo: your-username/your-repo
    branch: main
    deploy_on_push: true
  run_command: python -c "import sys; sys.path.insert(0, '.'); from main_optimized import app; import uvicorn; uvicorn.run(app, host='0.0.0.0', port=$PORT)"
  environment_slug: python
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 8000
  health_check:
    http_path: /
  envs:
  - key: PORT
    value: "8000"
  - key: BACKEND_HOST
    value: "0.0.0.0"
  - key: BACKEND_PORT
    value: "8000"
  - key: DEBUG_MODE
    value: "false"
```

### Step 2: Deploy via Dashboard

1. **Go to [DigitalOcean Dashboard](https://cloud.digitalocean.com/apps)**
2. **Click "Create App"**
3. **Connect GitHub repository**
4. **Select your repository and branch**
5. **DigitalOcean will auto-detect Python app**

### Step 3: Configure Build Settings

- **Build Command**: 
  ```bash
  pip install -r requirements.txt && python -m spacy download en_core_web_sm --quiet || echo "spaCy optional"
  ```
- **Run Command**:
  ```bash
  python -c "import sys; sys.path.insert(0, '.'); from main_optimized import app; import uvicorn; uvicorn.run(app, host='0.0.0.0', port=$PORT)"
  ```

### Step 4: Set Environment Variables

In App Platform settings:

**Required:**
- `PORT` = `8000`
- `BACKEND_HOST` = `0.0.0.0`
- `BACKEND_PORT` = `8000`
- `DEBUG_MODE` = `false`

**Optional:**
- `GROQ_API_KEY` = `your_groq_api_key`
- `OPENAI_API_KEY` = `your_openai_api_key`

**Security:**
- `SECRET_KEY` = `your_64_char_secret_key`
- `ENCRYPTION_KEY` = `your_encryption_key`
- `JWT_SECRET` = `your_64_char_jwt_secret`
- `API_KEY_HASH_SALT` = `your_salt_value`

**CORS:**
- `ALLOWED_ORIGINS` = `https://your-frontend-domain.com`

### Step 5: Deploy

Click **"Create Resources"** and wait for deployment.

### Step 6: Get Your URL

After deployment:
```
https://privacy-browser-backend-xxxxx.ondigitalocean.app
```

## ⚡ Why DigitalOcean is Better

- **Fast deploys**: 3-5 minutes
- **Excellent performance**: Better resources than Render
- **No cold starts**: Services stay warm
- **Auto-scaling**: Scales based on traffic
- **Built-in monitoring**: Metrics and logs
- **Custom domains**: Free SSL included
- **Database options**: Easy PostgreSQL/Redis integration

## 💰 Pricing

- **Basic ($5/month)**: 512MB RAM, 1GB storage
- **Professional ($12/month)**: 1GB RAM, better performance
- **Professional Plus ($24/month)**: 2GB RAM, production-ready

## 🔧 Troubleshooting

### Build Fails
- Check Python version (3.11)
- Verify `requirements.txt` exists
- Review build logs in dashboard

### App Not Starting
- Verify environment variables
- Check run command
- Review logs in dashboard

## 📊 Monitoring

- **Logs**: Available in dashboard
- **Metrics**: CPU, memory, requests
- **Health**: Configured at `/` endpoint

## ✅ Post-Deployment

- [ ] Backend accessible at DigitalOcean URL
- [ ] Health check works
- [ ] Environment variables set
- [ ] Frontend config updated
- [ ] Test API endpoints

## 🆘 Need Help?

- DigitalOcean Docs: https://docs.digitalocean.com/products/app-platform
- Support: Available in dashboard

