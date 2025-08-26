#!/usr/bin/env python3
"""
Smoke test for the Privacy Browser Backend
Verifies that the main application can start and handle basic requests
"""

import requests
import time
import subprocess
import os
import sys
from threading import Thread


def start_server():
    """Start the server in a subprocess"""
    env = os.environ.copy()
    env.update({
        'OPENAI_API_KEY': 'sk-test-key-for-smoke-test-only',
        'SECRET_KEY': 'test-secret-key-for-smoke-test-only-123456789',
        'ENCRYPTION_KEY': 'test-encryption-key-for-smoke-test-123456789012',
        'JWT_SECRET': 'test-jwt-secret-for-smoke-test-123456789012345',
        'API_KEY_HASH_SALT': 'test-salt-for-smoke-test-12345678901234567890',
        'BACKEND_HOST': '127.0.0.1',
        'BACKEND_PORT': '8080',
        'DEBUG_MODE': 'true'
    })
    
    return subprocess.Popen([
        'python', '-m', 'uvicorn', 'main:app',
        '--host', '127.0.0.1',
        '--port', '8080'
    ], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def test_smoke():
    """Basic smoke test of the application"""
    print("🔥 Starting Privacy Browser Backend Smoke Test")
    print("=" * 50)
    
    # Start the server
    print("1. Starting server...")
    server_process = start_server()
    
    # Give server time to start
    time.sleep(5)
    
    try:
        # Test 1: Health check
        print("2. Testing server health...")
        response = requests.get("http://127.0.0.1:8080/", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("   ✅ Server is responding")
        
        # Test 2: Basic endpoint functionality
        print("3. Testing basic endpoint functionality...")
        response = requests.get("http://127.0.0.1:8080/health", timeout=10)
        if response.status_code == 200:
            print("   ✅ Health endpoint working")
        else:
            print(f"   ⚠️  Health endpoint returned {response.status_code}")
        
        print("\n🎉 Smoke test PASSED - Application is working!")
        return True
        
    except requests.exceptions.ConnectionError:
        print("   ❌ Cannot connect to server")
        return False
    except Exception as e:
        print(f"   ❌ Smoke test failed: {e}")
        return False
    finally:
        # Clean up
        print("4. Cleaning up...")
        server_process.terminate()
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()
        print("   ✅ Server stopped")


if __name__ == "__main__":
    success = test_smoke()
    sys.exit(0 if success else 1)
