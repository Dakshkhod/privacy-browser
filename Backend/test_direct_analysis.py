#!/usr/bin/env python3
"""
Test script for the new direct policy analysis functionality
"""

import requests
import time

def test_direct_analysis():
    """Test the direct policy analysis endpoint"""
    print("🔍 Testing Direct Policy Analysis Endpoint")
    print("=" * 50)
    
    # Test cases with direct privacy policy URLs
    test_urls = [
        ("https://policies.google.com/privacy", "Google Privacy Policy"),
        ("https://www.facebook.com/privacy/policy/", "Facebook Privacy Policy"), 
        ("https://github.com/site/privacy", "GitHub Privacy Policy"),
        ("https://www.reddit.com/policies/privacy-policy", "Reddit Privacy Policy"),
    ]
    
    for url, description in test_urls:
        print(f"\n📄 Testing: {description}")
        print(f"URL: {url}")
        
        start_time = time.time()
        
        try:
            response = requests.post(
                "http://localhost:8000/analyze-direct-policy",
                json={"url": url},
                timeout=30
            )
            
            duration = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                
                # Extract key information
                policy_url = result.get('policy_url', 'Unknown')
                content_length = result.get('content_length', 0)
                risk_level = result.get('risk_level', 'Unknown')
                data_types_count = len(result.get('data_types', {}))
                warnings_count = len(result.get('warnings', []))
                
                print(f"✅ SUCCESS in {duration:.2f} seconds")
                print(f"   Policy URL: {policy_url}")
                print(f"   Content length: {content_length:,} characters")
                print(f"   Risk level: {risk_level}")
                print(f"   Data types found: {data_types_count}")
                print(f"   Warnings: {warnings_count}")
                
                # Show some data types if available
                data_types = result.get('data_types', {})
                if data_types:
                    print(f"   Data types: {', '.join(list(data_types.keys())[:5])}")
                
            else:
                print(f"❌ FAILED in {duration:.2f} seconds")
                print(f"   Status: {response.status_code}")
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}...")
                    
        except requests.exceptions.Timeout:
            duration = time.time() - start_time
            print(f"⏰ TIMEOUT after {duration:.2f} seconds")
            
        except Exception as e:
            duration = time.time() - start_time
            print(f"💥 EXCEPTION in {duration:.2f} seconds: {e}")
        
        print()
    
    print("✨ Direct Policy Analysis Test Complete!")

if __name__ == "__main__":
    test_direct_analysis() 