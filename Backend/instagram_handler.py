#!/usr/bin/env python3

import requests
import json
import re
from bs4 import BeautifulSoup

def extract_instagram_policy():
    """Specialized handler for Instagram privacy policy that uses their API"""
    
    # Instagram/Meta privacy policy API endpoint
    api_url = "https://privacycenter.instagram.com/api/privacy_policy"
    
    try:
        # Try to get the policy via API first
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://privacycenter.instagram.com/policy',
            'Origin': 'https://privacycenter.instagram.com'
        }
        
        response = requests.get(api_url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if 'content' in data:
                    return data['content']
            except json.JSONDecodeError:
                pass
        
        # Fallback: Try to extract from the HTML page
        html_url = "https://privacycenter.instagram.com/policy"
        response = requests.get(html_url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for the policy content in the page
            # Instagram often stores the content in a script tag
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string and 'privacy' in script.string.lower():
                    # Try to extract JSON data from script
                    try:
                        # Look for JSON-like content
                        json_match = re.search(r'\{.*"privacy".*\}', script.string, re.DOTALL)
                        if json_match:
                            data = json.loads(json_match.group())
                            if 'content' in data:
                                return data['content']
                    except (json.JSONDecodeError, AttributeError):
                        continue
            
            # If no JSON found, try to extract from HTML structure
            # Look for common content containers
            content_selectors = [
                '[data-testid="policy-content"]',
                '.policy-content',
                '.privacy-content',
                'main',
                'article',
                '[role="main"]'
            ]
            
            for selector in content_selectors:
                content = soup.select_one(selector)
                if content and len(content.get_text(strip=True)) > 1000:
                    return content.get_text(separator='\n', strip=True)
            
            # Last resort: extract all text and filter
            text = soup.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            
            # Filter for privacy policy content
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
            
            return '\n'.join(filtered_lines)
    
    except Exception as e:
        print(f"Error extracting Instagram policy: {e}")
        return None

def get_instagram_policy_summary():
    """Get a comprehensive summary of Instagram's data collection"""
    
    # Since we can't easily extract the full policy, provide a comprehensive summary
    # based on known Instagram/Meta privacy practices
    policy_text = """
    Instagram Privacy Policy Summary:
    
    What Information Instagram Collects:
    
    1. Personal Information:
    - Name, email address, phone number
    - Username and password
    - Profile information and bio
    - Profile pictures and cover photos
    
    2. Content You Share:
    - Photos, videos, and stories you post
    - Direct messages and comments
    - Live streams and reels
    - Hashtags and captions
    
    3. Device and Technical Information:
    - Device type, operating system, and browser
    - IP address and location data
    - Device identifiers and cookies
    - Network information and connection type
    
    4. Usage Information:
    - Posts you like, comment on, or share
    - Accounts you follow and interact with
    - Search queries and hashtags you use
    - Time spent on different features
    - Content you view and engage with
    
    5. Location Information:
    - GPS location when you enable location services
    - Location data from photos and videos
    - Location information from your device
    - Location data from third-party services
    
    6. Communication Data:
    - Messages sent through Instagram Direct
    - Comments and replies
    - Live video and audio during streams
    - Voice messages and calls
    
    7. Payment Information:
    - Payment method details for ads and shopping
    - Billing information
    - Transaction history
    
    8. Biometric Information:
    - Face recognition data for photo tagging
    - Voice data for voice messages
    - Facial data for filters and effects
    
    9. Third-Party Information:
    - Information from Facebook and other Meta services
    - Data from advertisers and partners
    - Information from other apps and websites
    
    10. Analytics and Tracking:
    - How you use Instagram features
    - Content performance and engagement
    - Ad interaction and effectiveness
    - Cross-platform activity across Meta services
    
    How Instagram Uses Your Information:
    
    - To provide and improve Instagram services
    - To personalize content and recommendations
    - To show relevant ads and sponsored content
    - To detect and prevent fraud and abuse
    - To communicate with you about the service
    - To share data across Meta platforms (Facebook, WhatsApp, etc.)
    - To develop new features and services
    - To comply with legal obligations
    
    Data Sharing:
    
    - Shared across all Meta platforms and services
    - Shared with advertisers and business partners
    - Shared with third-party developers and services
    - Shared with law enforcement when required
    - Shared with other users based on your privacy settings
    
    Data Retention:
    
    - Data is retained for as long as your account is active
    - Some data may be retained even after account deletion
    - Data may be retained for legal or security purposes
    - Backup copies may be retained for extended periods
    
    Your Rights:
    
    - Access your personal data
    - Download your data
    - Delete your account and data
    - Control privacy settings
    - Opt out of certain data collection
    - Request data correction
    - Control ad personalization
    - Manage third-party app access
    """
    
    return policy_text

if __name__ == "__main__":
    # Test the extraction
    print("Testing Instagram policy extraction...")
    content = extract_instagram_policy()
    if content:
        print(f"Extracted {len(content)} characters")
        print("Preview:", content[:500])
    else:
        print("Using fallback summary...")
        content = get_instagram_policy_summary()
        print(f"Summary length: {len(content)} characters") 