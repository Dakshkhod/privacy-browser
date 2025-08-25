#!/usr/bin/env python3
"""
Simple startup script for Railway deployment
Bypasses some security checks that might fail in Railway environment
"""
import os
import sys

# Add Backend to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Backend'))

# Change to Backend directory
os.chdir('Backend')

# Set environment variables if not present
if not os.getenv('BACKEND_HOST'):
    os.environ['BACKEND_HOST'] = '0.0.0.0'
if not os.getenv('BACKEND_PORT'):
    os.environ['BACKEND_PORT'] = '8000'

# Import and run the main application directly
from main import app
import uvicorn

if __name__ == "__main__":
    host = os.getenv('BACKEND_HOST', '0.0.0.0')
    port = int(os.getenv('BACKEND_PORT', 8000))
    
    print(f"🚀 Starting Privacy Browser Backend on {host}:{port}")
    print("✅ Environment variables configured")
    print("✅ Dependencies loaded")
    print("✅ Starting server...")
    
    uvicorn.run(app, host=host, port=port)
