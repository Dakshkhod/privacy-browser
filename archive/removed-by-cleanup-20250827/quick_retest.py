#!/usr/bin/env python3
"""
Quick retest of previously failing sites
"""

import requests
import time

def quick_retest():
    """Quickly test the sites that were failing to see improvements"""
    print("🔄 Quick Retest of Previously Failing Sites")
    print("=" * 50)
    
    # Sites that were failing before
    failing_sites = [
        "https://reddit.com",
        "https://stackoverflow.com", 
        "https://microsoft.com",
        "https://amazon.com"
    ]
    
    print(f"Testing {len(failing_sites)} previously failing sites...")
    print()
    
    for i, url in enumerate(failing_sites, 1):
        print(f"🧪 Test {i}: {url}")
        
        start_time = time.time()
        
        try:
            response = requests.post(
                "http://localhost:8000/fetch-privacy-policy",
                json={"url": url},
                timeout=15  # Shorter timeout for quick test
            )
            
            duration = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                policy_url = result.get('policy_url', 'Unknown')
                policy_length = len(result.get('policy_text', ''))
                
                print(f"   ✅ NOW WORKING! ({duration:.1f}s)")
                print(f"      Found: {policy_url}")
                print(f"      Content: {policy_length:,} chars")
                
            else:
                print(f"   ❌ Still failing ({duration:.1f}s)")
                try:
                    error = response.json().get('detail', 'Unknown')
                    print(f"      Error: {error}")
                except:
                    print(f"      Status: {response.status_code}")
                    
        except Exception as e:
            duration = time.time() - start_time
            print(f"   💥 Error ({duration:.1f}s): {e}")
        
        print()
        time.sleep(0.5)
    
    print("🎯 Quick retest complete!")

if __name__ == "__main__":
    quick_retest() 