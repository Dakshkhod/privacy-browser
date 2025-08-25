#!/usr/bin/env python3
"""
Comprehensive test for enhanced privacy policy detection
"""

import requests
import time
import json

def test_enhanced_detection():
    """Test enhanced privacy policy detection on various difficult websites"""
    print("🚀 Testing Enhanced Privacy Policy Detection")
    print("=" * 70)
    
    # Mix of easy and challenging websites
    test_cases = [
        {
            "url": "https://linkedin.com",
            "description": "LinkedIn (Previously failing - social media)",
            "difficulty": "medium"
        },
        {
            "url": "https://twitter.com",
            "description": "Twitter (Challenging - social media)",
            "difficulty": "hard"
        },
        {
            "url": "https://reddit.com",
            "description": "Reddit (Medium difficulty)",
            "difficulty": "medium"
        },
        {
            "url": "https://stackoverflow.com",
            "description": "Stack Overflow (Medium difficulty)",
            "difficulty": "medium"
        },
        {
            "url": "https://github.com",
            "description": "GitHub (Should be easy)",
            "difficulty": "easy"
        },
        {
            "url": "https://google.com",
            "description": "Google (Should be easy)",
            "difficulty": "easy"
        },
        {
            "url": "https://microsoft.com",
            "description": "Microsoft (Corporate site)",
            "difficulty": "medium"
        },
        {
            "url": "https://amazon.com",
            "description": "Amazon (E-commerce)",
            "difficulty": "medium"
        },
        {
            "url": "https://facebook.com",
            "description": "Facebook (Challenging - needs Selenium)",
            "difficulty": "hard"
        },
        {
            "url": "https://youtube.com",
            "description": "YouTube (Previously failing)",
            "difficulty": "medium"
        }
    ]
    
    results = {
        'total': 0,
        'successful': 0,
        'failed': 0,
        'easy_success': 0,
        'easy_total': 0,
        'medium_success': 0,
        'medium_total': 0,
        'hard_success': 0,
        'hard_total': 0,
        'total_time': 0,
        'details': []
    }
    
    print(f"Testing {len(test_cases)} websites with enhanced detection algorithms...")
    print()
    
    for i, test_case in enumerate(test_cases, 1):
        url = test_case['url']
        description = test_case['description']
        difficulty = test_case['difficulty']
        
        print(f"📋 Test {i}/{len(test_cases)}: {description}")
        print(f"   URL: {url}")
        print(f"   Difficulty: {difficulty.upper()}")
        
        start_time = time.time()
        
        try:
            response = requests.post(
                "http://localhost:8000/fetch-privacy-policy",
                json={"url": url},
                timeout=30  # Reasonable timeout
            )
            
            duration = time.time() - start_time
            results['total_time'] += duration
            
            if response.status_code == 200:
                result = response.json()
                policy_url = result.get('policy_url', 'Unknown')
                policy_length = len(result.get('policy_text', ''))
                
                print(f"   ✅ SUCCESS in {duration:.2f}s")
                print(f"      Found: {policy_url}")
                print(f"      Content: {policy_length:,} characters")
                
                results['successful'] += 1
                if difficulty == 'easy':
                    results['easy_success'] += 1
                elif difficulty == 'medium':
                    results['medium_success'] += 1
                else:
                    results['hard_success'] += 1
                
                results['details'].append({
                    'url': url,
                    'status': 'success',
                    'duration': duration,
                    'difficulty': difficulty,
                    'policy_url': policy_url,
                    'content_length': policy_length
                })
                
            else:
                print(f"   ❌ FAILED in {duration:.2f}s")
                print(f"      Status: {response.status_code}")
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    print(f"      Error: {error_detail}")
                except:
                    print(f"      Response: {response.text[:100]}...")
                
                results['failed'] += 1
                results['details'].append({
                    'url': url,
                    'status': 'failed',
                    'duration': duration,
                    'difficulty': difficulty,
                    'error': response.status_code
                })
                
        except requests.exceptions.Timeout:
            duration = time.time() - start_time
            results['total_time'] += duration
            print(f"   ⏰ TIMEOUT after {duration:.2f}s")
            results['failed'] += 1
            results['details'].append({
                'url': url,
                'status': 'timeout',
                'duration': duration,
                'difficulty': difficulty
            })
            
        except Exception as e:
            duration = time.time() - start_time
            results['total_time'] += duration
            print(f"   💥 ERROR in {duration:.2f}s: {e}")
            results['failed'] += 1
            results['details'].append({
                'url': url,
                'status': 'error',
                'duration': duration,
                'difficulty': difficulty,
                'error': str(e)
            })
        
        # Update difficulty counters
        results['total'] += 1
        if difficulty == 'easy':
            results['easy_total'] += 1
        elif difficulty == 'medium':
            results['medium_total'] += 1
        else:
            results['hard_total'] += 1
        
        print()
        time.sleep(0.5)  # Brief pause between tests
    
    # Comprehensive summary
    print("=" * 70)
    print("📊 ENHANCED DETECTION TEST RESULTS")
    print("=" * 70)
    
    overall_success_rate = (results['successful'] / results['total']) * 100
    avg_time = results['total_time'] / results['total']
    
    print(f"Overall Performance:")
    print(f"  📈 Success Rate: {overall_success_rate:.1f}% ({results['successful']}/{results['total']})")
    print(f"  ⏱️  Average Time: {avg_time:.2f} seconds per site")
    print(f"  🕒 Total Time: {results['total_time']:.1f} seconds")
    print()
    
    # Difficulty-based analysis
    if results['easy_total'] > 0:
        easy_rate = (results['easy_success'] / results['easy_total']) * 100
        print(f"Easy Websites: {easy_rate:.1f}% ({results['easy_success']}/{results['easy_total']})")
    
    if results['medium_total'] > 0:
        medium_rate = (results['medium_success'] / results['medium_total']) * 100
        print(f"Medium Websites: {medium_rate:.1f}% ({results['medium_success']}/{results['medium_total']})")
    
    if results['hard_total'] > 0:
        hard_rate = (results['hard_success'] / results['hard_total']) * 100
        print(f"Hard Websites: {hard_rate:.1f}% ({results['hard_success']}/{results['hard_total']})")
    
    print()
    
    # Performance assessment
    print("🎯 Performance Assessment:")
    if overall_success_rate >= 80:
        print("   🔥 EXCELLENT - Detection working very well!")
    elif overall_success_rate >= 60:
        print("   ✅ GOOD - Solid improvement achieved")
    elif overall_success_rate >= 40:
        print("   ⚠️  FAIR - Some improvement but needs work")
    else:
        print("   ❌ NEEDS IMPROVEMENT - Detection still struggling")
    
    if avg_time <= 5:
        print("   ⚡ EXCELLENT SPEED - Very fast responses")
    elif avg_time <= 10:
        print("   👍 GOOD SPEED - Acceptable response times")
    else:
        print("   🐌 SLOW - Response times need optimization")
    
    print()
    print("🚀 KEY IMPROVEMENTS IMPLEMENTED:")
    print("   • Enhanced privacy policy scoring algorithm")
    print("   • Comprehensive path testing (50+ patterns)")
    print("   • Advanced link discovery from homepages")
    print("   • Multiple subdomain testing")
    print("   • Intelligent batching and parallel processing")
    print("   • Improved text extraction and content filtering")
    print("   • Faster timeouts for quicker failure detection")
    print("   • Better error handling and retry logic")
    print("   • Selenium fallback for major social media sites")
    
    # Show successful sites
    successful_sites = [d for d in results['details'] if d['status'] == 'success']
    if successful_sites:
        print(f"\n✅ Successfully analyzed {len(successful_sites)} sites:")
        for site in successful_sites:
            print(f"   • {site['url']} ({site['duration']:.1f}s)")
    
    # Show failed sites
    failed_sites = [d for d in results['details'] if d['status'] != 'success']
    if failed_sites:
        print(f"\n❌ Failed to analyze {len(failed_sites)} sites:")
        for site in failed_sites:
            print(f"   • {site['url']} ({site.get('error', 'unknown error')})")

if __name__ == "__main__":
    test_enhanced_detection() 