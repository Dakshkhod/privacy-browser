#!/usr/bin/env python3
"""
Lightweight startup script for Render free tier
Optimized for minimal memory usage and faster startup
"""
import os
import sys
import time
from datetime import datetime

# Minimal environment setup
if not os.getenv('SECRET_KEY'):
    import secrets
    os.environ['SECRET_KEY'] = secrets.token_urlsafe(32)

if not os.getenv('JWT_SECRET'):
    import secrets
    os.environ['JWT_SECRET'] = secrets.token_urlsafe(32)

# Set minimal required environment variables
os.environ.setdefault('BACKEND_HOST', '0.0.0.0')
os.environ.setdefault('DEBUG_MODE', 'false')
os.environ.setdefault('LOG_LEVEL', 'WARNING')  # Reduce logging

# Get port from Render
port = int(os.getenv('PORT', 8000))
os.environ['BACKEND_PORT'] = str(port)

print(f"🚀 Starting lightweight Privacy Browser Backend")
print(f"📍 Host: 0.0.0.0:{port}")
print(f"🕐 Time: {datetime.utcnow().isoformat()}")

# Add Backend to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

try:
    os.chdir(backend_dir)
    print(f"📁 Working directory: {os.getcwd()}")
except Exception as e:
    print(f"⚠️ Directory change failed: {e}")

# Create minimal directories
try:
    os.makedirs('logs', exist_ok=True)
    os.makedirs('temp', exist_ok=True)
    print("📂 Created required directories")
except Exception as e:
    print(f"⚠️ Directory creation failed: {e}")

# Import with error handling
try:
    print("📦 Loading application...")
    from main import app
    print("✅ Application loaded successfully")
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("🔧 Attempting to install missing dependencies...")
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
    from main import app
    print("✅ Application loaded after dependency installation")
except Exception as e:
    print(f"❌ Critical error loading application: {e}")
    sys.exit(1)

# Start server with minimal settings
if __name__ == "__main__":
    try:
        import uvicorn
        
        print("🌟 Starting uvicorn server...")
        print(f"🔗 Available at: https://privacybrowser-backend.onrender.com")
        
        # Minimal uvicorn configuration for low memory usage
        uvicorn.run(
            app, 
            host="0.0.0.0", 
            port=port,
            workers=1,  # Single worker to save memory
            loop="asyncio",
            log_level="warning",  # Minimal logging
            access_log=False,  # Disable access logs to save memory
            reload=False,
            debug=False
        )
    except Exception as e:
        print(f"❌ Server startup failed: {e}")
        sys.exit(1)
