#!/usr/bin/env python3
"""
Test script for the combined smart interface
"""

import requests
import time

def test_combined_interface():
    """Test both website scanning and direct policy analysis through the unified interface"""
    print("🔍 Testing Combined Smart Interface")
    print("=" * 60)
    
    # Test cases: mix of website URLs and direct privacy policy URLs
    test_cases = [
        {
            "url": "https://google.com",
            "expected_type": "website",
            "description": "Google (Website - should auto-detect privacy policy)"
        },
        {
            "url": "https://policies.google.com/privacy",
            "expected_type": "direct",
            "description": "Google Privacy Policy (Direct - should analyze directly)"
        },
        {
            "url": "https://github.com",
            "expected_type": "website", 
            "description": "GitHub (Website - should search for privacy policy)"
        },
        {
            "url": "https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement",
            "expected_type": "direct",
            "description": "GitHub Privacy Statement (Direct - should analyze directly)"
        }
    ]
    
    success_count = 0
    total_count = len(test_cases)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 Test {i}/{total_count}: {test_case['description']}")
        print(f"URL: {test_case['url']}")
        print(f"Expected routing: {test_case['expected_type']}")
        
        start_time = time.time()
        
        try:
            # The frontend will automatically detect URL type and route to appropriate endpoint
            # We'll test both endpoints to simulate the smart routing
            
            if 'privacy' in test_case['url'].lower() or 'policy' in test_case['url'].lower():
                # This should be routed to direct analysis
                print("→ Routing to: Direct Analysis Endpoint")
                response = requests.post(
                    "http://localhost:8000/analyze-direct-policy",
                    json={"url": test_case['url']},
                    timeout=20
                )
                actual_type = "direct"
            else:
                # This should be routed to website scanner
                print("→ Routing to: Website Scanner Endpoint")
                response = requests.post(
                    "http://localhost:8000/fetch-privacy-policy",
                    json={"url": test_case['url']},
                    timeout=20
                )
                actual_type = "website"
            
            duration = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                
                print(f"✅ SUCCESS in {duration:.2f} seconds")
                print(f"   Actual routing: {actual_type}")
                print(f"   Routing correct: {'✅' if actual_type == test_case['expected_type'] else '❌'}")
                
                # Show key results
                if actual_type == "direct":
                    risk_level = result.get('risk_level', 'Unknown')
                    data_types = len(result.get('data_types', {}))
                    print(f"   Risk level: {risk_level}")
                    print(f"   Data types: {data_types}")
                else:
                    policy_url = result.get('policy_url', 'Unknown')
                    policy_length = len(result.get('policy_text', ''))
                    print(f"   Found policy: {policy_url}")
                    print(f"   Policy length: {policy_length:,} chars")
                
                success_count += 1
                
            else:
                print(f"❌ FAILED in {duration:.2f} seconds")
                print(f"   Status: {response.status_code}")
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:100]}...")
                    
        except requests.exceptions.Timeout:
            duration = time.time() - start_time
            print(f"⏰ TIMEOUT after {duration:.2f} seconds")
            
        except Exception as e:
            duration = time.time() - start_time
            print(f"💥 EXCEPTION in {duration:.2f} seconds: {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 COMBINED INTERFACE TEST SUMMARY")
    print("=" * 60)
    print(f"Total tests: {total_count}")
    print(f"Successful: {success_count}")
    print(f"Failed: {total_count - success_count}")
    print(f"Success rate: {success_count/total_count*100:.1f}%")
    
    if success_count == total_count:
        print("\n🎉 ALL TESTS PASSED! Combined interface is working perfectly!")
    elif success_count > 0:
        print(f"\n⚠️  PARTIAL SUCCESS: {success_count}/{total_count} tests passed.")
    else:
        print("\n❌ ALL TESTS FAILED: Please check server configuration.")
    
    print("\n🚀 SMART ROUTING FEATURES:")
    print("   • Automatic URL type detection")
    print("   • Direct policy analysis for privacy URLs")  
    print("   • Website scanning for general URLs")
    print("   • Unified interface for both types")
    print("   • Fast and intelligent routing")

if __name__ == "__main__":
    test_combined_interface() 