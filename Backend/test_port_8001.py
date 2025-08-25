#!/usr/bin/env python3
"""
Test new server on port 8001
"""

import requests
import time

def test_new_server():
    print("Testing server on port 8001...")
    time.sleep(3)  # Wait for server to start
    
    # Test server health
    try:
        response = requests.get("http://localhost:8001/", timeout=5)
        print(f"✅ Server responding: {response.status_code}")
    except Exception as e:
        print(f"❌ Server not responding: {e}")
        return
    
    # Test new direct analysis endpoint
    print("\n🔍 Testing Direct Analysis Endpoint")
    try:
        response = requests.post(
            "http://localhost:8001/analyze-direct-policy",
            json={"url": "https://policies.google.com/privacy"},
            timeout=20
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ SUCCESS!")
            print(f"   Policy URL: {result.get('policy_url', 'Unknown')}")
            print(f"   Risk level: {result.get('risk_level', 'Unknown')}")
            print(f"   Data types: {len(result.get('data_types', {}))}")
            print(f"   Warnings: {len(result.get('warnings', []))}")
            print(f"   Content length: {result.get('content_length', 0):,} chars")
        else:
            print(f"❌ Failed: {response.status_code}")
            print(f"Response: {response.text[:200]}...")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_new_server() 