#!/usr/bin/env python3
"""
Quick test script to verify the server is responding
"""

import requests
import time

def quick_test():
    print("🔍 Quick test of optimized backend...")
    
    start_time = time.time()
    
    try:
        response = requests.post(
            "http://localhost:8000/fetch-privacy-policy",
            json={"url": "https://google.com"},
            timeout=30
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ SUCCESS in {duration:.2f} seconds")
            print(f"   Policy URL: {result.get('policy_url')}")
            print(f"   Policy length: {len(result.get('policy_text', ''))} chars")
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
            
    except Exception as e:
        duration = time.time() - start_time
        print(f"❌ Error after {duration:.2f}s: {e}")

if __name__ == "__main__":
    quick_test() 