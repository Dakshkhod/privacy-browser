#!/usr/bin/env python3
"""
Status checker for Privacy Browser services
"""

import requests
import time
import sys

def check_service(url, name, timeout=5):
    """Check if a service is running"""
    try:
        response = requests.get(url, timeout=timeout)
        if response.status_code == 200:
            return True, f"✅ {name} is running"
        else:
            return False, f"❌ {name} returned status {response.status_code}"
    except requests.exceptions.RequestException as e:
        return False, f"❌ {name} is not running: {str(e)}"

def main():
    print("🔍 Checking Privacy Browser Services...")
    print("=" * 50)
    
    # Check backend
    backend_ok, backend_msg = check_service("http://localhost:8000/health", "Backend")
    print(backend_msg)
    
    # Check frontend
    frontend_ok, frontend_msg = check_service("http://localhost:5173", "Frontend")
    print(frontend_msg)
    
    print("=" * 50)
    
    if backend_ok and frontend_ok:
        print("🎉 All services are running!")
        print("\n📱 Access your application at:")
        print("   Frontend: http://localhost:5173")
        print("   Backend API: http://localhost:8000")
        return 0
    else:
        print("⚠️  Some services are not running.")
        print("\n🚀 To start services:")
        print("   1. Run 'start_services.bat' (Windows)")
        print("   2. Or manually start:")
        print("      - Backend: cd Backend && python start_secure.py")
        print("      - Frontend: cd Frontend && npm run dev")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 