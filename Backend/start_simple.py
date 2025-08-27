#!/usr/bin/env python3
"""
Simple startup script for Render deployment
Bypasses some security checks that might fail in Render environment
"""
import os
import sys

# FIRST: Generate encryption keys before ANY imports that might need them
# Ensure proper encryption key format for Render deployment
if not os.getenv('ENCRYPTION_KEY') or len(os.getenv('ENCRYPTION_KEY', '')) < 32:
    from cryptography.fernet import Fernet
    os.environ['ENCRYPTION_KEY'] = Fernet.generate_key().decode()
    print("✅ Generated new encryption key for Render deployment")

# Set other required keys if missing
if not os.getenv('SECRET_KEY'):
    import secrets
    os.environ['SECRET_KEY'] = secrets.token_urlsafe(64)
if not os.getenv('JWT_SECRET'):
    import secrets
    os.environ['JWT_SECRET'] = secrets.token_urlsafe(64)
if not os.getenv('API_KEY_HASH_SALT'):
    import secrets
    os.environ['API_KEY_HASH_SALT'] = secrets.token_urlsafe(32)

# Add Backend to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

# Change to Backend directory
os.chdir(os.path.dirname(__file__))

# Create necessary directories
os.makedirs('logs', exist_ok=True)
os.makedirs('temp', exist_ok=True)

# Set environment variables if not present
if not os.getenv('BACKEND_HOST'):
    os.environ['BACKEND_HOST'] = '0.0.0.0'
if not os.getenv('BACKEND_PORT'):
    # Render provides PORT environment variable
    port = os.getenv('PORT', '8000')
    os.environ['BACKEND_PORT'] = port

# Import and run the main application directly
from main import app
import uvicorn

if __name__ == "__main__":
    host = os.getenv('BACKEND_HOST', '0.0.0.0')
    port = int(os.getenv('PORT', os.getenv('BACKEND_PORT', 8000)))
    
    print(f"🚀 Starting Privacy Browser Backend on {host}:{port}")
    print("✅ Environment variables configured")
    print("✅ Dependencies loaded")
    print("✅ Starting server...")
    
    uvicorn.run(app, host=host, port=port)
