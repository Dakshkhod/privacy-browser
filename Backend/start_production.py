#!/usr/bin/env python3
"""
Production Startup Script for Privacy Browser Backend

This script starts the backend service using Gunicorn for production deployment.
It includes proper logging, process management, and security checks.
"""

import os
import sys
import subprocess
import logging
from pathlib import Path
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_environment():
    """Check if all required environment variables are set."""
    load_dotenv()
    
    required_vars = [
        'OPENAI_API_KEY',
        'SECRET_KEY',
        'ENCRYPTION_KEY',
        'JWT_SECRET',
        'API_KEY_HASH_SALT'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        return False
    
    logger.info("Environment variables validated successfully")
    return True

def check_dependencies():
    """Check if all required dependencies are installed."""
    try:
        import fastapi
        import uvicorn
        import gunicorn
        import cryptography
        import jwt
        import requests
        import bs4
        import selenium
        import spacy
        import openai
        logger.info("All dependencies installed successfully")
        return True
    except ImportError as e:
        logger.error(f"Missing dependency: {e}")
        return False

def create_directories():
    """Create necessary directories if they don't exist."""
    directories = ['logs', 'temp', 'data']
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        logger.info(f"Directory {directory} ready")

def start_gunicorn():
    """Start the application using Gunicorn."""
    try:
        # Check if gunicorn config exists
        config_file = Path('gunicorn.conf.py')
        if not config_file.exists():
            logger.error("Gunicorn configuration file not found")
            return False
        
        # Start Gunicorn
        cmd = [
            'gunicorn',
            'main:app',
            '--config', 'gunicorn.conf.py',
            '--preload'
        ]
        
        logger.info("Starting Gunicorn server...")
        logger.info(f"Command: {' '.join(cmd)}")
        
        # Execute Gunicorn
        subprocess.run(cmd, check=True)
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to start Gunicorn: {e}")
        return False
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        return True
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return False

def main():
    """Main function to start the production server."""
    logger.info("Starting Privacy Browser Backend in production mode")
    
    # Perform checks
    if not check_environment():
        logger.error("Environment check failed")
        sys.exit(1)
    
    if not check_dependencies():
        logger.error("Dependency check failed")
        sys.exit(1)
    
    create_directories()
    
    # Start the server
    if not start_gunicorn():
        logger.error("Failed to start server")
        sys.exit(1)

if __name__ == "__main__":
    main()
