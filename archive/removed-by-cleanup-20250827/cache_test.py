#!/usr/bin/env python3
"""
Cache performance test
"""

import requests
import time

def test_cache():
    print("Testing cache performance (repeat requests)...")
    print()
    
    for i in range(3):
        print(f"Request {i+1} to Google:")
        start = time.time()
        response = requests.post(
            "http://localhost:8000/fetch-privacy-policy",
            json={"url": "https://google.com"}
        )
        duration = time.time() - start
        
        if response.status_code == 200:
            print(f"   Success in {duration:.3f} seconds")
        else:
            print(f"   Failed in {duration:.3f} seconds")
        print()

if __name__ == "__main__":
    test_cache() 