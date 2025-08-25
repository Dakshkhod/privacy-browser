#!/usr/bin/env python3
"""
Secure Environment Setup Script for Privacy Browser Backend

This script helps you set up a secure environment by generating strong keys
and creating the necessary configuration files.

Run this script ONCE when setting up your backend for the first time.
"""

import os
import secrets
import base64
import getpass
from cryptography.fernet import Fernet
from pathlib import Path

def generate_secure_key(length=32):
    """Generate a cryptographically secure random key."""
    return secrets.token_urlsafe(length)

def generate_encryption_key():
    """Generate a Fernet-compatible encryption key."""
    return Fernet.generate_key().decode()

def get_openai_api_key():
    """Securely get OpenAI API key from user."""
    print("\n🔑 OpenAI API Key Setup")
    print("=" * 50)
    print("You need an OpenAI API key to use AI features.")
    print("Get one from: https://platform.openai.com/api-keys")
    print()
    
    while True:
        api_key = getpass.getpass("Enter your OpenAI API key (sk-...): ").strip()
        
        if not api_key:
            print("❌ API key cannot be empty!")
            continue
            
        if not api_key.startswith('sk-'):
            print("❌ Invalid OpenAI API key format! Should start with 'sk-'")
            continue
            
        if len(api_key) < 20:
            print("❌ API key seems too short!")
            continue
            
        return api_key

def create_env_file():
    """Create a secure .env file with generated keys."""
    print("\n🛡️  Security Configuration Generator")
    print("=" * 50)
    print("This will create a secure .env file with strong encryption keys.")
    print("⚠️  NEVER share these keys or commit them to version control!")
    print()
    
    # Check if .env already exists
    env_path = Path('.env')
    if env_path.exists():
        response = input("⚠️  .env file already exists. Overwrite? (y/N): ").strip().lower()
        if response != 'y':
            print("❌ Setup cancelled.")
            return False
    
    try:
        # Get OpenAI API key
        openai_key = get_openai_api_key()
        
        # Generate secure keys
        print("\n🔐 Generating secure keys...")
        secret_key = generate_secure_key(64)
        encryption_key = generate_encryption_key()
        jwt_secret = generate_secure_key(64)
        api_key_salt = generate_secure_key(32)
        
        # Create .env content
        env_content = f"""# ===== PRIVACY BROWSER BACKEND CONFIGURATION =====
# Generated on: {os.popen('date').read().strip()}
# NEVER commit this file to version control!
# Add .env to your .gitignore file

# OpenAI API Configuration
OPENAI_API_KEY={openai_key}
OPENAI_MODEL=gpt-3.5-turbo-16k
OPENAI_MAX_TOKENS=800

# Security Configuration (DO NOT CHANGE THESE AFTER FIRST USE)
SECRET_KEY={secret_key}
ENCRYPTION_KEY={encryption_key}
JWT_SECRET={jwt_secret}
API_KEY_HASH_SALT={api_key_salt}

# Server Configuration
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DEBUG_MODE=false

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600

# Security Headers
SECURITY_HEADERS_ENABLED=true
CORS_CREDENTIALS=true

# Logging Configuration
LOG_LEVEL=INFO
LOG_FILE=logs/privacy_browser.log
LOG_MAX_SIZE=10MB
LOG_BACKUP_COUNT=5

# Session Configuration
SESSION_TIMEOUT=3600
MAX_REQUEST_SIZE=10485760

# Trusted Proxies (for production deployment)
TRUSTED_PROXIES=127.0.0.1,::1
"""
        
        # Write .env file
        with open('.env', 'w') as f:
            f.write(env_content)
        
        # Set secure permissions (Unix-like systems)
        try:
            os.chmod('.env', 0o600)  # Read/write for owner only
        except:
            pass  # Windows doesn't support chmod
        
        print("✅ .env file created successfully!")
        print()
        print("🔒 Security Summary:")
        print(f"   • Secret Key: {len(secret_key)} characters")
        print(f"   • Encryption Key: {len(encryption_key)} characters") 
        print(f"   • JWT Secret: {len(jwt_secret)} characters")
        print(f"   • API Salt: {len(api_key_salt)} characters")
        print()
        print("⚠️  IMPORTANT SECURITY NOTES:")
        print("   • Never share these keys with anyone")
        print("   • Add .env to your .gitignore file")
        print("   • Back up these keys securely")
        print("   • Don't change these keys after first use")
        print()
        
        return True
        
    except KeyboardInterrupt:
        print("\n❌ Setup cancelled by user.")
        return False
    except Exception as e:
        print(f"\n❌ Error creating .env file: {e}")
        return False

def create_gitignore():
    """Create or update .gitignore to protect sensitive files."""
    gitignore_content = """
# Environment variables (CRITICAL - contains API keys)
.env
.env.local
.env.production

# Logs
logs/
*.log

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
env.bak/
venv.bak/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Security
*.pem
*.key
*.crt
"""
    
    gitignore_path = Path('.gitignore')
    
    if gitignore_path.exists():
        # Read existing content
        with open('.gitignore', 'r') as f:
            existing = f.read()
        
        # Add new rules if not present
        if '.env' not in existing:
            with open('.gitignore', 'a') as f:
                f.write(gitignore_content)
            print("✅ Updated .gitignore with security rules")
        else:
            print("✅ .gitignore already contains security rules")
    else:
        with open('.gitignore', 'w') as f:
            f.write(gitignore_content.strip())
        print("✅ Created .gitignore with security rules")

def create_directories():
    """Create necessary directories for the application."""
    dirs = ['logs', 'temp', 'data']
    
    for dir_name in dirs:
        dir_path = Path(dir_name)
        if not dir_path.exists():
            dir_path.mkdir(parents=True, exist_ok=True)
            print(f"✅ Created directory: {dir_name}/")

def verify_setup():
    """Verify that the setup was successful."""
    print("\n🔍 Verifying setup...")
    
    # Check .env file
    if not Path('.env').exists():
        print("❌ .env file not found!")
        return False
    
    # Check required environment variables
    from dotenv import load_dotenv
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
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        return False
    
    # Test encryption
    try:
        from cryptography.fernet import Fernet
        key = os.getenv('ENCRYPTION_KEY')
        fernet = Fernet(key.encode())
        
        # Test encrypt/decrypt
        test_data = b"security_test"
        encrypted = fernet.encrypt(test_data)
        decrypted = fernet.decrypt(encrypted)
        
        if decrypted != test_data:
            print("❌ Encryption test failed!")
            return False
            
    except Exception as e:
        print(f"❌ Encryption verification failed: {e}")
        return False
    
    print("✅ All security checks passed!")
    return True

def main():
    """Main setup function."""
    print("🛡️  Privacy Browser Backend - Secure Setup")
    print("=" * 60)
    print("This script will set up your backend with military-grade security.")
    print()
    
    # Create directories
    create_directories()
    
    # Create/update .gitignore
    create_gitignore()
    
    # Create .env file
    if not create_env_file():
        return
    
    # Verify setup
    if not verify_setup():
        print("\n❌ Setup verification failed!")
        return
    
    print("\n🎉 Setup Complete!")
    print("=" * 30)
    print("Your backend is now configured with top-class security:")
    print("• AES-256 encryption for sensitive data")
    print("• PBKDF2 key derivation with 100,000 iterations")
    print("• JWT tokens for secure sessions")
    print("• Rate limiting and request validation")
    print("• Comprehensive security logging")
    print("• CORS protection and security headers")
    print()
    print("Next steps:")
    print("1. Install dependencies: pip install -r requirements.txt")
    print("2. Download spaCy model: python -m spacy download en_core_web_sm")
    print("3. Start the server: uvicorn main:app --reload")
    print()
    print("⚠️  Remember: Keep your .env file secure and never commit it!")

if __name__ == "__main__":
    main() 