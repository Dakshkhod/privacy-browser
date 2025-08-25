#!/usr/bin/env python3
"""
Performance test script for the optimized privacy policy fetcher
"""

import requests
import time
import json

def test_url(url, description):
    """Test a single URL and measure performance"""
    print(f"\n🔍 Testing: {description}")
    print(f"URL: {url}")
    
    start_time = time.time()
    
    try:
        response = requests.post(
            "http://localhost:8000/fetch-privacy-policy",
            json={"url": url},
            timeout=60  # 1 minute timeout
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        if response.status_code == 200:
            result = response.json()
            policy_url = result.get('policy_url', 'Unknown')
            policy_length = len(result.get('policy_text', ''))
            
            print(f"✅ SUCCESS in {duration:.2f} seconds")
            print(f"   Found at: {policy_url}")
            print(f"   Policy length: {policy_length:,} characters")
            
            return True, duration
            
        elif response.status_code == 404:
            print(f"❌ NOT FOUND in {duration:.2f} seconds")
            return False, duration
            
        else:
            print(f"❌ ERROR {response.status_code} in {duration:.2f} seconds")
            print(f"   Response: {response.text}")
            return False, duration
            
    except requests.exceptions.Timeout:
        end_time = time.time()
        duration = end_time - start_time
        print(f"⏰ TIMEOUT after {duration:.2f} seconds")
        return False, duration
        
    except Exception as e:
        end_time = time.time()
        duration = end_time - start_time
        print(f"💥 EXCEPTION in {duration:.2f} seconds: {e}")
        return False, duration

def main():
    """Run performance tests"""
    print("🚀 Privacy Policy Fetcher Performance Test")
    print("=" * 50)
    
    # Test cases with expected difficulty levels
    test_cases = [
        ("https://google.com", "Google (Easy - standard path)"),
        ("https://facebook.com", "Facebook (Easy - standard path)"),
        ("https://github.com", "GitHub (Medium - common site)"),
        ("https://reddit.com", "Reddit (Medium - popular site)"),
        ("https://stackoverflow.com", "Stack Overflow (Medium)"),
        ("https://example.com", "Example.com (Hard - unlikely to have policy)"),
    ]
    
    results = []
    total_start = time.time()
    
    for url, description in test_cases:
        success, duration = test_url(url, description)
        results.append({
            'url': url,
            'description': description,
            'success': success,
            'duration': duration
        })
        
        # Small delay between tests
        time.sleep(1)
    
    total_duration = time.time() - total_start
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 PERFORMANCE SUMMARY")
    print("=" * 50)
    
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    print(f"Total tests: {len(results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")
    print(f"Success rate: {len(successful)/len(results)*100:.1f}%")
    print(f"Total time: {total_duration:.2f} seconds")
    print(f"Average time per test: {total_duration/len(results):.2f} seconds")
    
    if successful:
        avg_success_time = sum(r['duration'] for r in successful) / len(successful)
        min_time = min(r['duration'] for r in successful)
        max_time = max(r['duration'] for r in successful)
        
        print(f"\n⏱️  Successful requests timing:")
        print(f"   Average: {avg_success_time:.2f} seconds")
        print(f"   Fastest: {min_time:.2f} seconds")
        print(f"   Slowest: {max_time:.2f} seconds")
    
    print("\n🎯 Performance Goals:")
    print("   - Fast sites (Google, Facebook): < 5 seconds")
    print("   - Medium sites: < 10 seconds") 
    print("   - Complex sites: < 15 seconds")
    print("   - Overall average: < 10 seconds")
    
    # Performance assessment
    fast_sites = ['google.com', 'facebook.com']
    fast_results = [r for r in successful if any(site in r['url'] for site in fast_sites)]
    
    if fast_results and all(r['duration'] < 5 for r in fast_results):
        print("\n✅ Fast sites performance: EXCELLENT")
    elif fast_results and all(r['duration'] < 10 for r in fast_results):
        print("\n⚠️  Fast sites performance: GOOD")
    else:
        print("\n❌ Fast sites performance: NEEDS IMPROVEMENT")
    
    if avg_success_time < 10:
        print("✅ Overall performance: EXCELLENT")
    elif avg_success_time < 15:
        print("⚠️  Overall performance: GOOD")
    else:
        print("❌ Overall performance: NEEDS IMPROVEMENT")

if __name__ == "__main__":
    main() 