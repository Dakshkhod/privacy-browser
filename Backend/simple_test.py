#!/usr/bin/env python3
"""
Simple test to verify server and endpoints
"""

import requests
import time

def test_endpoints():
    print("Testing server endpoints...")
    
    # Test 1: Server health
    try:
        response = requests.get("http://localhost:8000/", timeout=5)
        print(f"✅ Server responding: {response.status_code}")
    except Exception as e:
        print(f"❌ Server not responding: {e}")
        return
    
    # Test 2: Original endpoint
    try:
        response = requests.post(
            "http://localhost:8000/fetch-privacy-policy",
            json={"url": "https://google.com"},
            timeout=15
        )
        print(f"✅ Original endpoint: {response.status_code}")
    except Exception as e:
        print(f"❌ Original endpoint error: {e}")
    
    # Test 3: New direct analysis endpoint
    try:
        response = requests.post(
            "http://localhost:8000/analyze-direct-policy",
            json={"url": "https://policies.google.com/privacy"},
            timeout=15
        )
        print(f"✅ Direct analysis endpoint: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   Risk level: {result.get('risk_level', 'Unknown')}")
            print(f"   Data types: {len(result.get('data_types', {}))}")
        elif response.status_code == 404:
            print("   ❌ Endpoint not found - server may need restart")
        else:
            print(f"   Response: {response.text[:100]}...")
    except Exception as e:
        print(f"❌ Direct analysis error: {e}")

if __name__ == "__main__":
    test_endpoints() 