#!/usr/bin/env python3

import requests
from bs4 import BeautifulSoup
import re
import time

def test_instagram_extraction():
    url = 'https://privacycenter.instagram.com/policy'
    
    print("Testing Instagram privacy policy extraction...")
    
    # Test 1: Basic HTTP request
    print("\n1. Testing basic HTTP request...")
    try:
        r = requests.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }, timeout=30)
        print(f"Status: {r.status_code}")
        print(f"Content length: {len(r.text)}")
        
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            
            # Test our extract_text_smartly function
            print("\n2. Testing text extraction...")
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Try to find main content areas
            main_content = None
            content_selectors = [
                'main', '[role="main"]', '.main-content', '.content-main',
                '.policy-content', '.privacy-content', '.legal-content',
                '.page-content', '.article-content', '.text-content',
                '[data-testid="policy-content"]', '.policy-text', '.legal-text',
                '.privacy-policy-content', '.meta-policy-content', '.instagram-policy',
                'article', 'section', '.container', '.content', '#content', '#main'
            ]
            
            for selector in content_selectors:
                main_content = soup.select_one(selector)
                if main_content and len(main_content.get_text(strip=True)) > 200:
                    print(f"Found content with selector: {selector}")
                    break
            
            if main_content:
                text = main_content.get_text(separator='\n', strip=True)
                print(f"Main content text length: {len(text)}")
                print(f"Text preview: {text[:200]}...")
            else:
                print("No main content found, trying fallback...")
                # Find all divs and sections with substantial text
                content_candidates = soup.find_all(['div', 'section', 'article'])
                if content_candidates:
                    content_candidates = sorted(content_candidates, 
                                              key=lambda x: len(x.get_text(strip=True)), 
                                              reverse=True)
                    for i, candidate in enumerate(content_candidates[:3]):
                        text_length = len(candidate.get_text(strip=True))
                        print(f"Candidate {i+1}: {text_length} characters")
                        if text_length > 500:
                            text = candidate.get_text(separator='\n', strip=True)
                            print(f"Using candidate {i+1} with {text_length} characters")
                            break
                    else:
                        text = soup.get_text(separator='\n', strip=True)
                        print(f"Using fallback text: {len(text)} characters")
                else:
                    text = soup.get_text(separator='\n', strip=True)
                    print(f"Using full page text: {len(text)} characters")
            
            # Clean up the text
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            
            # Enhanced filtering for privacy policy content
            filtered_lines = []
            for line in lines:
                if (len(line) > 20 or 
                    any(keyword in line.lower() for keyword in [
                        'privacy', 'policy', 'data', 'information', 'collect', 'use', 'share',
                        'personal', 'user', 'account', 'profile', 'content', 'photo', 'video',
                        'message', 'communication', 'location', 'device', 'browser', 'cookie',
                        'tracking', 'analytics', 'advertising', 'third-party', 'legal', 'rights',
                        'access', 'delete', 'modify', 'retention', 'security', 'encryption'
                    ])):
                    filtered_lines.append(line)
            
            result = '\n'.join(filtered_lines)
            
            # Additional cleaning for Instagram/Meta specific content
            if 'instagram' in soup.get_text().lower() or 'meta' in soup.get_text().lower():
                result = re.sub(r'\n\s*\n\s*\n', '\n\n', result)
                result = re.sub(r' +', ' ', result)
            
            print(f"\n3. Final extracted text length: {len(result)}")
            print(f"Text preview: {result[:500]}...")
            
            # Test data type detection
            print("\n4. Testing data type detection...")
            text_lower = result.lower()
            
            patterns = {
                'email': ['email', 'e-mail', 'electronic mail', 'email address'],
                'phone': ['phone', 'telephone', 'mobile', 'cell phone', 'phone number', 'contact number'],
                'location': ['location', 'gps', 'geolocation', 'address', 'where you are', 'place', 'city', 'country', 'coordinates'],
                'name': ['name', 'first name', 'last name', 'full name', 'username', 'display name', 'profile name'],
                'payment': ['payment', 'credit card', 'billing', 'financial', 'bank account', 'debit card', 'payment method'],
                'browsing': ['browsing', 'cookies', 'web beacons', 'analytics', 'browser data', 'web data', 'internet activity'],
                'id': ['social security', 'passport', 'driver license', 'government id', 'identity document', 'national id'],
                'biometric': ['biometric', 'fingerprint', 'facial recognition', 'face data', 'voice data', 'iris scan'],
                'health': ['health', 'medical', 'wellness', 'fitness', 'health data', 'medical information'],
                'behavior': ['preferences', 'interests', 'behavior', 'likes', 'dislikes', 'habits', 'patterns'],
                'social': ['social connections', 'friends', 'contacts', 'followers', 'following', 'social network', 'relationships'],
                'content': ['photos', 'videos', 'images', 'posts', 'stories', 'content', 'media', 'uploads', 'shared content'],
                'communication': ['messages', 'comments', 'direct messages', 'chats', 'conversations', 'communications'],
                'device': ['device information', 'device id', 'hardware', 'software', 'operating system', 'device model'],
                'age': ['age', 'birth date', 'birthday', 'date of birth', 'age verification'],
                'education': ['education', 'school', 'university', 'academic', 'degree', 'qualification'],
                'employment': ['employment', 'job', 'work', 'occupation', 'employer', 'professional']
            }
            
            data_types = {}
            for data_type, keywords in patterns.items():
                score = sum(1 for keyword in keywords if keyword in text_lower)
                if score > 0:
                    if data_type in ['content', 'social', 'communication', 'behavior']:
                        data_types[data_type] = min(score * 3, 15)
                    elif data_type in ['biometric', 'health', 'payment', 'id']:
                        data_types[data_type] = min(score * 4, 20)
                    else:
                        data_types[data_type] = min(score * 2, 10)
            
            # Special detection for Instagram/Meta specific data collection
            if 'instagram' in text_lower or 'meta' in text_lower:
                for data_type in data_types:
                    if data_type in ['content', 'social', 'communication', 'behavior', 'location', 'browsing']:
                        data_types[data_type] = min(data_types[data_type] + 5, 20)
            
            print(f"Detected data types: {data_types}")
            print(f"Number of data types: {len(data_types)}")
            
        else:
            print(f"Failed to fetch content: {r.status_code}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_instagram_extraction() 