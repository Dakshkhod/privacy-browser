"""
Fast Privacy Policy Fetcher for Production
Optimized for speed while maintaining accuracy
"""
import asyncio
import aiohttp
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import re
import logging

logger = logging.getLogger(__name__)

class FastPrivacyFetcher:
    def __init__(self):
        self.session = None
        
        # High-probability privacy policy paths (ordered by likelihood)
        self.privacy_paths = [
            '/privacy-policy',
            '/privacy',
            '/privacypolicy', 
            '/privacy.html',
            '/privacy-policy.html',
            '/legal/privacy',
            '/privacy-notice',
            '/privacy-statement',
            '/privacy-policy.php',
            '/privacy.php',
            '/legal/privacy-policy',
            '/privacy-policy/',
            '/privacy/',
            '/terms-and-privacy',
            '/privacy-terms',
            '/policies/privacy',
            '/about/privacy',
            '/company/privacy',
            '/help/privacy',
            '/support/privacy',
            '/en/privacy',
            '/privacy-center',
            '/privacy-information',
            '/privacy-security',
            '/legal',
            '/terms'  # Often contains privacy info
        ]
        
        # Privacy-related keywords for content detection
        self.privacy_keywords = [
            'privacy policy', 'personal information', 'data collection',
            'cookies', 'tracking', 'third parties', 'data sharing',
            'data protection', 'personal data', 'information we collect',
            'how we use', 'data usage', 'privacy notice', 'privacy statement'
        ]
    
    async def fetch_privacy_policy(self, url: str) -> Dict:
        """Fast privacy policy fetching with multiple strategies"""
        start_time = time.time()
        
        try:
            # Create aiohttp session with optimized settings
            timeout = aiohttp.ClientTimeout(total=30, connect=5)
            connector = aiohttp.TCPConnector(
                limit=10,
                limit_per_host=5,
                ttl_dns_cache=300,
                use_dns_cache=True
            )
            
            async with aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            ) as session:
                self.session = session
                
                # Strategy 1: Direct privacy policy URL detection
                result = await self._try_direct_privacy_urls(url)
                if result['success']:
                    result['fetch_time'] = time.time() - start_time
                    return result
                
                # Strategy 2: Scan main page for privacy links
                result = await self._scan_main_page_for_privacy(url)
                if result['success']:
                    result['fetch_time'] = time.time() - start_time
                    return result
                
                # Strategy 3: Common legal page patterns
                result = await self._try_legal_pages(url)
                if result['success']:
                    result['fetch_time'] = time.time() - start_time
                    return result
                
        except Exception as e:
            logger.error(f"Fast fetcher error: {e}")
            
        # If all strategies fail
        return {
            'success': False,
            'policy_text': '',
            'policy_url': '',
            'error': 'No privacy policy found after trying multiple strategies',
            'fetch_time': time.time() - start_time,
            'method': 'fast_fetcher_failed'
        }
    
    async def _try_direct_privacy_urls(self, base_url: str) -> Dict:
        """Try direct privacy policy URLs (fastest method)"""
        base_domain = self._get_base_domain(base_url)
        
        # Test top 10 most common paths in parallel
        tasks = []
        for path in self.privacy_paths[:10]:
            test_url = urljoin(base_domain, path)
            tasks.append(self._test_privacy_url(test_url))
        
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Return first successful result
            for result in results:
                if isinstance(result, dict) and result.get('success'):
                    return result
                    
        except Exception as e:
            logger.error(f"Error testing direct URLs: {e}")
        
        return {'success': False}
    
    async def _scan_main_page_for_privacy(self, url: str) -> Dict:
        """Scan main page for privacy policy links"""
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    return {'success': False}
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # Look for privacy-related links
                privacy_links = []
                
                # Search in common locations
                for link in soup.find_all('a', href=True):
                    href = link.get('href', '').lower()
                    text = link.get_text('', strip=True).lower()
                    
                    # Check if link looks like privacy policy
                    if any(keyword in href for keyword in ['privacy', 'legal']) or \
                       any(keyword in text for keyword in ['privacy policy', 'privacy', 'legal']):
                        full_url = urljoin(url, link['href'])
                        privacy_links.append(full_url)
                
                # Test found links
                if privacy_links:
                    for link_url in privacy_links[:5]:  # Test top 5 candidates
                        result = await self._test_privacy_url(link_url)
                        if result.get('success'):
                            return result
                            
        except Exception as e:
            logger.error(f"Error scanning main page: {e}")
        
        return {'success': False}
    
    async def _try_legal_pages(self, base_url: str) -> Dict:
        """Try common legal/terms pages that might contain privacy info"""
        base_domain = self._get_base_domain(base_url)
        
        legal_paths = ['/legal', '/terms', '/terms-of-service', '/terms-and-conditions']
        
        for path in legal_paths:
            test_url = urljoin(base_domain, path)
            try:
                async with self.session.get(test_url) as response:
                    if response.status == 200:
                        html = await response.text()
                        
                        # Check if page contains substantial privacy information
                        privacy_score = self._calculate_privacy_score(html)
                        if privacy_score > 3:  # Threshold for privacy content
                            policy_text = self._extract_privacy_content(html)
                            if len(policy_text) > 500:  # Minimum content length
                                return {
                                    'success': True,
                                    'policy_text': policy_text,
                                    'policy_url': test_url,
                                    'method': 'legal_page_scan',
                                    'privacy_score': privacy_score
                                }
            except:
                continue
        
        return {'success': False}
    
    async def _test_privacy_url(self, url: str) -> Dict:
        """Test a single URL for privacy policy content"""
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    return {'success': False}
                
                html = await response.text()
                
                # Quick privacy content validation
                privacy_score = self._calculate_privacy_score(html)
                
                if privacy_score >= 3:  # Strong privacy indicators
                    policy_text = self._extract_privacy_content(html)
                    
                    if len(policy_text) > 300:  # Minimum viable privacy policy length
                        return {
                            'success': True,
                            'policy_text': policy_text,
                            'policy_url': url,
                            'method': 'direct_url_test',
                            'privacy_score': privacy_score
                        }
        except:
            pass
        
        return {'success': False}
    
    def _calculate_privacy_score(self, html: str) -> int:
        """Calculate privacy content score (0-10)"""
        html_lower = html.lower()
        score = 0
        
        # Core privacy terms (high value)
        core_terms = ['privacy policy', 'personal information', 'data collection', 
                     'information we collect', 'how we use your information']
        for term in core_terms:
            if term in html_lower:
                score += 2
        
        # Supporting privacy terms (medium value)
        support_terms = ['cookies', 'tracking', 'third parties', 'data sharing',
                        'personal data', 'data protection', 'privacy notice']
        for term in support_terms:
            if term in html_lower:
                score += 1
        
        return min(score, 10)  # Cap at 10
    
    def _extract_privacy_content(self, html: str) -> str:
        """Extract and clean privacy policy content"""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer']):
            element.decompose()
        
        # Get main content
        text = soup.get_text()
        
        # Clean up text
        lines = [line.strip() for line in text.splitlines()]
        lines = [line for line in lines if line and len(line) > 10]
        
        return '\n'.join(lines)
    
    def _get_base_domain(self, url: str) -> str:
        """Get base domain from URL"""
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"

# Global instance
fast_fetcher = FastPrivacyFetcher()
