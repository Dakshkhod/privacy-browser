"""
Ultra-Advanced Privacy Policy Fetcher
Maximum efficiency with multiple fallback strategies and intelligent detection
Version: 3.0 - Next Generation
"""
import asyncio
import aiohttp
import aiofiles
import time
import json
import hashlib
import re
import pickle
from typing import Dict, List, Tuple, Optional, Set
from collections import OrderedDict

# Import JavaScript fetcher for problematic sites
try:
    from js_fetcher import get_js_fetcher, JavaScriptFetcher
    JS_FETCHER_AVAILABLE = True
except ImportError as e:
    JS_FETCHER_AVAILABLE = False
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup
import logging
from pathlib import Path
import xml.etree.ElementTree as ET

# Try to import advanced dependencies (fallback gracefully)
try:
    import spacy
    NLP_AVAILABLE = True
    try:
        nlp = spacy.load("en_core_web_sm")
    except:
        nlp = None
        NLP_AVAILABLE = False
except ImportError:
    NLP_AVAILABLE = False
    nlp = None

logger = logging.getLogger(__name__)

class UltraPrivacyFetcher:
    """
    Next-generation privacy policy fetcher with:
    - Multi-strategy detection (direct, sitemap, robots.txt, DOM scanning)
    - Intelligent caching (memory + persistent file cache)
    - NLP-based content analysis
    - Domain-specific optimizations
    - Parallel processing with smart prioritization
    - Comprehensive error handling and fallbacks
    """
    
    def __init__(self, cache_dir: str = "./data/cache"):
        # Multi-tier caching system
        self.memory_cache: OrderedDict = OrderedDict()
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_ttl = 86400  # 24 hours
        self.max_memory_cache = 500
        
        # Connection management
        self.connector = None
        self.session = None
        
        # Performance tracking
        self.stats = {
            'memory_hits': 0,
            'disk_hits': 0,
            'cache_misses': 0,
            'total_requests': 0,
            'avg_response_time': 0,
            'strategy_success': {
                'direct_url': 0,
                'sitemap': 0,
                'robots_txt': 0,
                'dom_scan': 0,
                'domain_specific': 0
            }
        }
        
        # Domain-specific knowledge base
        self.domain_patterns = self._load_domain_patterns()
        
        # Privacy detection patterns (enhanced with GDPR/CCPA)
        self.privacy_indicators = {
            'title_patterns': [
                r'privacy\s+policy', r'privacy\s+notice', r'privacy\s+statement',
                r'data\s+protection', r'cookie\s+policy', r'privacy\s+&\s+cookie',
                r'information\s+we\s+collect', r'how\s+we\s+use', r'your\s+privacy',
                r'privacy\s+center', r'data\s+privacy', r'california\s+privacy'
            ],
            'url_patterns': [
                r'/privacy', r'/legal/privacy', r'/policies/privacy',
                r'/privacy-policy', r'/privacypolicy', r'/privacy_policy',
                r'/privacy-notice', r'/data-protection', r'/cookie-policy',
                r'/gdpr', r'/ccpa', r'/your-privacy-choices', r'/consumer-privacy'
            ],
            'content_keywords': {
                'critical': ['privacy policy', 'data protection', 'personal information',
                            'information we collect', 'how we use your data', 'your privacy rights',
                            'data we collect', 'we collect information', 'personal data we collect'],
                'high': ['cookies', 'tracking', 'third parties', 'data sharing',
                        'personal data', 'user information', 'data collection',
                        'share your data', 'third party', 'service providers',
                        'advertising partners', 'data retention', 'delete your data'],
                'medium': ['privacy', 'data', 'information', 'security', 'protection',
                          'consent', 'opt-out', 'rights', 'gdpr', 'ccpa', 'california',
                          'european', 'eea', 'controller', 'processor', 'lawful basis'],
                'compliance': ['right to access', 'right to delete', 'right to correct',
                              'data portability', 'do not sell', 'opt out', 'withdraw consent',
                              'supervisory authority', 'data protection officer', 'dpo']
            }
        }
        
        # Common privacy policy URL templates - expanded for better coverage
        self.url_templates = [
            # Standard paths (most common)
            "{base}/privacy", "{base}/privacy-policy", "{base}/privacy_policy",
            "{base}/privacypolicy", "{base}/privacy-notice", "{base}/privacy-statement",
            # Legal paths
            "{base}/legal/privacy", "{base}/legal/privacy-policy", "{base}/legal/privacy_policy",
            "{base}/policies/privacy", "{base}/policy/privacy", "{base}/legal",
            "{base}/legal/terms", "{base}/terms/privacy",
            # About/company paths
            "{base}/about/privacy", "{base}/company/privacy", "{base}/about/privacy-policy",
            "{base}/corporate/privacy", "{base}/info/privacy",
            # Help/support paths
            "{base}/help/privacy", "{base}/support/privacy", "{base}/help/privacy-policy",
            "{base}/faq/privacy", "{base}/resources/privacy",
            # Localized paths
            "{base}/en/privacy", "{base}/en/privacy-policy", "{base}/en-us/privacy",
            "{base}/en-gb/privacy", "{base}/intl/en/privacy", "{base}/us/privacy",
            "{base}/us/legal/privacy", "{base}/en/legal/privacy",
            # Alternative formats
            "{base}/privacy.html", "{base}/privacy.php", "{base}/privacy.aspx",
            "{base}/privacy-policy.html", "{base}/privacy-policy.php", "{base}/privacy.htm",
            # Center/portal paths
            "{base}/privacy-center", "{base}/privacycenter", "{base}/privacy-portal",
            "{base}/trust-center", "{base}/trustcenter",
            # GDPR/CCPA specific
            "{base}/gdpr", "{base}/gdpr/privacy", "{base}/ccpa", "{base}/california-privacy",
            "{base}/your-privacy-choices", "{base}/privacy-rights", "{base}/do-not-sell",
            # Cookie policies (often linked to privacy)
            "{base}/cookies", "{base}/cookie-policy", "{base}/cookiepolicy",
            # Data protection
            "{base}/data-privacy", "{base}/data-protection", "{base}/information-privacy",
            "{base}/user-privacy", "{base}/consumer-privacy",
            # Additional common patterns
            "{base}/terms-and-privacy", "{base}/privacy-terms", "{base}/privacy-security",
            "{base}/privacystatement", "{base}/PrivacyPolicy", "{base}/Privacy"
        ]

    async def __aenter__(self):
        """Async context manager setup with optimized connection pool"""
        self.connector = aiohttp.TCPConnector(
            limit=100,  # High concurrency
            limit_per_host=30,
            ttl_dns_cache=600,
            use_dns_cache=True,
            keepalive_timeout=60,
            enable_cleanup_closed=True,
            force_close=False
        )
        
        timeout = aiohttp.ClientTimeout(total=60, connect=10, sock_read=30)
        self.session = aiohttp.ClientSession(
            connector=self.connector,
            timeout=timeout,
            headers=self._get_smart_headers()
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Clean shutdown"""
        if self.session:
            await self.session.close()
        if self.connector:
            await self.connector.close()

    def _get_smart_headers(self) -> Dict[str, str]:
        """Generate realistic browser headers"""
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
        }

    def _load_domain_patterns(self) -> Dict:
        """Load domain-specific privacy policy patterns - expanded for better coverage"""
        return {
            # Social Media & Communication
            'google.com': {'paths': ['/policies/privacy', '/intl/en/policies/privacy', '/chrome/privacy'], 'priority': 10},
            'facebook.com': {'paths': ['https://mbasic.facebook.com/privacy/policy/?locale=en_US', '/privacy/policy', '/about/privacy'], 'priority': 10},
            'meta.com': {'paths': ['https://mbasic.facebook.com/privacy/policy/?locale=en_US', '/privacy/policy', '/legal/privacy'], 'priority': 10},
            'instagram.com': {'paths': ['https://mbasic.facebook.com/privacy/policy/?locale=en_US', '/legal/privacy', '/privacy/policy'], 'priority': 10},
            'twitter.com': {'paths': ['/en/privacy', '/privacy', '/privacy-policy', '/tos'], 'priority': 10},
            'x.com': {'paths': ['/en/privacy', '/privacy', '/privacy-policy'], 'priority': 10},
            'linkedin.com': {'paths': ['/legal/privacy-policy', '/privacy', '/privacy-policy'], 'priority': 10},
            'tiktok.com': {'paths': ['/legal/privacy-policy', '/legal/page/row/privacy-policy', '/privacy', '/legal/privacy-policy-us'], 'priority': 10},
            'snapchat.com': {'paths': ['/privacy/privacy-policy', '/privacy', '/policies/privacy'], 'priority': 10},
            'reddit.com': {'paths': ['/policies/privacy-policy', '/privacy', '/help/privacypolicy'], 'priority': 10},
            'whatsapp.com': {'paths': ['/legal/privacy-policy', '/legal/updates/privacy-policy', '/privacy'], 'priority': 10},
            'discord.com': {'paths': ['/privacy', '/privacy-policy', '/terms'], 'priority': 10},
            'telegram.org': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'pinterest.com': {'paths': ['/privacy/privacy-policy', '/privacy', '/_/_/policy/privacy-policy'], 'priority': 10},
            'tumblr.com': {'paths': ['/privacy', '/policy/en/privacy'], 'priority': 10},
            
            # Tech Giants
            'microsoft.com': {'paths': ['/privacy', '/en-us/privacy', '/privacystatement', '/en-us/privacystatement'], 'priority': 10},
            'apple.com': {'paths': ['/legal/privacy', '/privacy', '/legal/privacy/en-ww', '/privacy/features'], 'priority': 10},
            'amazon.com': {'paths': ['/gp/help/customer/display.html?nodeId=468496', '/privacy', '/privacy-policy'], 'priority': 10},
            'github.com': {'paths': ['/privacy', '/site/privacy', 'https://docs.github.com/en/site-policy/privacy-policies'], 'priority': 10},
            'zoom.us': {'paths': ['/privacy', '/privacy-and-legal'], 'priority': 10},
            'dropbox.com': {'paths': ['/privacy', '/terms/privacy'], 'priority': 10},
            'salesforce.com': {'paths': ['/company/privacy', '/privacy', '/legal/privacy'], 'priority': 10},
            'adobe.com': {'paths': ['/privacy', '/privacy/policy', '/legal/privacy'], 'priority': 10},
            'oracle.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            
            # Streaming & Entertainment
            'youtube.com': {'paths': ['/t/privacy', '/howyoutubeworks/our-commitments/protecting-user-data'], 'priority': 10},
            'netflix.com': {'paths': ['/privacy', '/legal/privacy'], 'priority': 10},
            'spotify.com': {'paths': ['/legal/privacy-policy', '/us/legal/privacy-policy'], 'priority': 10},
            'hulu.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'disneyplus.com': {'paths': ['/legal/privacy-policy', '/privacy'], 'priority': 10},
            'twitch.tv': {'paths': ['/p/legal/privacy-notice', '/p/legal/privacy-policy'], 'priority': 10},
            
            # E-commerce & Fintech
            'ebay.com': {'paths': ['/help/policies/member-behavior-policies/user-privacy-notice', '/privacy'], 'priority': 10},
            'etsy.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'shopify.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'paypal.com': {'paths': ['/legalhub/privacy-full', '/webapps/mpp/ua/privacy-full'], 'priority': 10},
            'stripe.com': {'paths': ['/privacy', '/legal/privacy'], 'priority': 10},
            'square.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'venmo.com': {'paths': ['/legal/us-privacy-policy', '/privacy'], 'priority': 10},
            'coinbase.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'robinhood.com': {'paths': ['/legal', '/privacy'], 'priority': 10},
            
            # Travel & Transportation
            'uber.com': {'paths': ['/legal/privacy/users', '/privacy', '/legal/privacy'], 'priority': 10},
            'lyft.com': {'paths': ['/privacy', '/terms/privacy'], 'priority': 10},
            'airbnb.com': {'paths': ['/terms/privacy_policy', '/privacy', '/help/article/2855'], 'priority': 10},
            'booking.com': {'paths': ['/content/privacy.html', '/privacy-policy.html'], 'priority': 10},
            'expedia.com': {'paths': ['/privacy', '/static/default/default/legacy/privacy'], 'priority': 10},
            
            # News & Media
            'nytimes.com': {'paths': ['/privacy', '/privacy/privacy-policy'], 'priority': 10},
            'washingtonpost.com': {'paths': ['/privacy-policy', '/privacy'], 'priority': 10},
            'bbc.com': {'paths': ['/usingthebbc/privacy', '/privacy'], 'priority': 10},
            'cnn.com': {'paths': ['/privacy', '/privacy-center'], 'priority': 10},
            'medium.com': {'paths': ['/policy/privacy-policy', '/privacy'], 'priority': 10},
            
            # Gaming
            'steam.com': {'paths': ['/privacy_agreement', '/privacy'], 'priority': 10},
            'steampowered.com': {'paths': ['/privacy_agreement'], 'priority': 10},
            'epicgames.com': {'paths': ['/privacypolicy', '/privacy'], 'priority': 10},
            'playstation.com': {'paths': ['/legal/privacy-policy', '/privacy'], 'priority': 10},
            'xbox.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            
            # Health & Fitness
            'fitbit.com': {'paths': ['/legal/privacy-policy', '/privacy'], 'priority': 10},
            'myfitnesspal.com': {'paths': ['/privacy-policy', '/privacy'], 'priority': 10},
            'peloton.com': {'paths': ['/privacy-policy', '/privacy'], 'priority': 10},
            
            # Food & Delivery
            'doordash.com': {'paths': ['/consumer-privacy', '/privacy'], 'priority': 10},
            'ubereats.com': {'paths': ['/privacy', '/legal/privacy'], 'priority': 10},
            'grubhub.com': {'paths': ['/legal/privacy-policy', '/privacy'], 'priority': 10},
            'instacart.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
        }

    def _get_cache_key(self, domain: str) -> str:
        """Generate cache key for domain"""
        return hashlib.sha256(domain.lower().encode()).hexdigest()

    async def _get_from_memory_cache(self, domain: str) -> Optional[Dict]:
        """Check memory cache"""
        cache_key = self._get_cache_key(domain)
        
        if cache_key in self.memory_cache:
            cached_item = self.memory_cache[cache_key]
            if time.time() - cached_item['timestamp'] < self.cache_ttl:
                self.memory_cache.move_to_end(cache_key)
                self.stats['memory_hits'] += 1
                logger.info(f"⚡ Memory cache HIT for {domain}")
                return cached_item['result']
            else:
                del self.memory_cache[cache_key]
        
        return None

    async def _get_from_disk_cache(self, domain: str) -> Optional[Dict]:
        """Check persistent disk cache"""
        cache_key = self._get_cache_key(domain)
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        
        if cache_file.exists():
            try:
                async with aiofiles.open(cache_file, 'rb') as f:
                    content = await f.read()
                    cached_item = pickle.loads(content)
                
                if time.time() - cached_item['timestamp'] < self.cache_ttl:
                    self.stats['disk_hits'] += 1
                    logger.info(f"💾 Disk cache HIT for {domain}")
                    # Promote to memory cache
                    await self._save_to_memory_cache(domain, cached_item['result'])
                    return cached_item['result']
                else:
                    cache_file.unlink()
            except Exception as e:
                logger.error(f"Disk cache read error: {e}")
        
        return None

    async def _save_to_memory_cache(self, domain: str, result: Dict):
        """Save to memory cache with LRU eviction"""
        cache_key = self._get_cache_key(domain)
        
        while len(self.memory_cache) >= self.max_memory_cache:
            self.memory_cache.popitem(last=False)
        
        self.memory_cache[cache_key] = {
            'result': result,
            'timestamp': time.time()
        }

    async def _save_to_disk_cache(self, domain: str, result: Dict):
        """Save to persistent disk cache"""
        cache_key = self._get_cache_key(domain)
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        
        try:
            cached_item = {
                'result': result,
                'timestamp': time.time()
            }
            async with aiofiles.open(cache_file, 'wb') as f:
                await f.write(pickle.dumps(cached_item))
        except Exception as e:
            logger.error(f"Disk cache write error: {e}")

    async def _fetch_url(self, url: str, max_retries: int = 2) -> Tuple[Optional[str], Optional[int], Optional[str]]:
        """Fetch URL with retries and comprehensive error handling"""
        for attempt in range(max_retries + 1):
            try:
                # Use different headers for different attempts
                headers = self._get_smart_headers()
                if attempt > 0:
                    # More aggressive headers for retries
                    headers.update({
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                    })
                
                async with self.session.get(url, allow_redirects=True, ssl=False, headers=headers) as response:
                    content_type = response.headers.get('content-type', '').lower()
                    
                    if response.status == 200:
                        if 'html' in content_type or 'text' in content_type or 'xml' in content_type:
                            content = await response.text(errors='ignore')
                            # Limit content size
                            if len(content) > 1000000:  # 1MB limit
                                content = content[:1000000]
                            return content, response.status, str(response.url)
                    
                    return None, response.status, str(response.url)
                    
            except asyncio.TimeoutError:
                if attempt < max_retries:
                    await asyncio.sleep(1.0 * (attempt + 1))  # Longer delays
                    continue
            except Exception as e:
                logger.debug(f"Fetch error for {url}: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
        
        return None, None, url

    def _calculate_privacy_score_advanced(self, content: str, url: str = "", title: str = "") -> int:
        """Advanced privacy scoring with NLP and pattern matching"""
        if not content or len(content) < 200:
            return 0
        
        score = 0
        content_lower = content.lower()
        url_lower = url.lower()
        title_lower = title.lower()
        
        # URL scoring (0-15 points)
        for pattern in self.privacy_indicators['url_patterns']:
            if re.search(pattern, url_lower):
                score += 15
                break
        
        # Title scoring (0-15 points)
        for pattern in self.privacy_indicators['title_patterns']:
            if re.search(pattern, title_lower):
                score += 15
                break
        
        # Content keyword scoring (0-40 points)
        critical_matches = sum(1 for kw in self.privacy_indicators['content_keywords']['critical'] 
                              if kw in content_lower)
        high_matches = sum(1 for kw in self.privacy_indicators['content_keywords']['high'] 
                          if kw in content_lower)
        medium_matches = sum(1 for kw in self.privacy_indicators['content_keywords']['medium'] 
                            if kw in content_lower)
        
        score += min(critical_matches * 10, 25)
        score += min(high_matches * 2, 10)
        score += min(medium_matches * 1, 5)
        
        # Structure analysis (0-20 points)
        word_count = len(content.split())
        if word_count > 2000:
            score += 10
        elif word_count > 1000:
            score += 7
        elif word_count > 500:
            score += 4
        
        # Legal document patterns (0-10 points)
        legal_patterns = [
            r'\b(effective date|last updated|last modified)',
            r'\b(section|article|clause)\s+\d+',
            r'\byour rights\b',
            r'\bcontact us\b',
            r'\bdata retention\b'
        ]
        legal_score = sum(3 for pattern in legal_patterns if re.search(pattern, content_lower, re.IGNORECASE))
        score += min(legal_score, 10)
        
        # NLP-based analysis (if available) (0-10 points)
        if NLP_AVAILABLE and nlp:
            try:
                doc = nlp(content[:10000])  # Limit for NLP processing
                entities = [ent.label_ for ent in doc.ents]
                if entities.count('ORG') > 3 and entities.count('PERSON') > 2:
                    score += 5
                # Check for legal/privacy terminology
                privacy_terms = ['privacy', 'data', 'information', 'collect', 'use', 'share']
                term_count = sum(1 for token in doc if token.text.lower() in privacy_terms)
                if term_count > 20:
                    score += 5
            except Exception as e:
                logger.debug(f"NLP analysis error: {e}")
        
        return min(score, 100)  # Cap at 100

    def _extract_clean_text(self, html: str) -> str:
        """Extract and clean policy text from HTML, including React/SPA apps"""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove unwanted elements first
            for element in soup(['script', 'style', 'nav', 'header', 'footer', 
                                'iframe', 'noscript', 'aside', 'button']):
                element.decompose()
            
            # Get body text as baseline
            body = soup.body or soup
            body_text = body.get_text(separator='\n', strip=True)
            
            # Try to find more specific content area
            main_content = (
                soup.find('main') or 
                soup.find('article') or 
                soup.find('div', {'class': re.compile(r'content|privacy|policy|legal', re.I)}) or
                soup.find('div', {'id': re.compile(r'content|privacy|policy|legal', re.I)})
            )
            
            # Use main_content only if it has substantial text (> 50% of body)
            if main_content:
                main_text = main_content.get_text(separator='\n', strip=True)
                if len(main_text) < len(body_text) * 0.5:
                    main_content = body  # Fallback to body if div is too small
            else:
                main_content = body
            
            text = main_content.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in text.splitlines() if line.strip() and len(line.strip()) > 15]
            html_text = '\n'.join(lines)
            
            # If regular HTML extraction yielded good content, return it
            if len(html_text) > 2000:
                return html_text
            
            # Fallback: try to extract from React/SPA script data (for JS-heavy sites)
            soup_for_scripts = BeautifulSoup(html, 'html.parser')
            extracted_from_scripts = self._extract_text_from_scripts(soup_for_scripts)
            if extracted_from_scripts and len(extracted_from_scripts) > len(html_text):
                return extracted_from_scripts
            
            return html_text
        except Exception as e:
            logger.error(f"Text extraction error: {e}")
            return ""
    
    def _extract_text_from_scripts(self, soup) -> str:
        """Extract readable text from React/SPA script bundles"""
        try:
            all_text = []
            
            # Look for script tags with embedded text content
            for script in soup.find_all('script'):
                text = script.string or ''
                if len(text) > 1000:
                    # Look for readable sentences in the script
                    # React apps often have text as string literals
                    sentences = re.findall(r'"([^"]{30,500})"', text)
                    for sentence in sentences:
                        # Filter for readable privacy-related content
                        if any(kw in sentence.lower() for kw in ['privacy', 'data', 'collect', 'information', 'share', 'use', 'policy', 'personal']):
                            # Clean the sentence
                            clean = sentence.replace('\\n', '\n').replace('\\u003c', '<').replace('\\u003e', '>')
                            clean = re.sub(r'<[^>]+>', '', clean)  # Remove any HTML
                            if len(clean) > 30 and not clean.startswith('{') and not clean.startswith('http'):
                                all_text.append(clean)
            
            # Deduplicate while preserving order
            seen = set()
            unique_text = []
            for t in all_text:
                if t not in seen:
                    seen.add(t)
                    unique_text.append(t)
            
            return '\n'.join(unique_text[:200])  # Limit to 200 unique sentences
        except Exception as e:
            logger.debug(f"Script extraction error: {e}")
            return ""

    def _get_title(self, html: str) -> str:
        """Extract page title"""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            title = soup.find('title')
            if title:
                return title.get_text(strip=True)
            # Fallback to h1
            h1 = soup.find('h1')
            if h1:
                return h1.get_text(strip=True)
        except:
            pass
        return ""

    async def _strategy_direct_urls(self, base_url: str, domain: str) -> Optional[Tuple[str, str, int]]:
        """Strategy 1: Test direct privacy policy URLs (fastest)"""
        logger.info(f"Strategy 1: Testing direct URLs for {domain}")
        
        # Get domain-specific patterns first
        test_urls = []
        if domain in self.domain_patterns:
            pattern = self.domain_patterns[domain]
            for path in pattern['paths']:
                # Handle full URLs vs relative paths
                if path.startswith('http'):
                    test_urls.append(path)
                else:
                    test_urls.append(urljoin(base_url, path))
        
        # Add standard templates
        for template in self.url_templates[:25]:  # Test top 25 most common
            test_urls.append(template.format(base=base_url))
        
        # Remove duplicates while preserving order
        seen = set()
        unique_urls = []
        for url in test_urls:
            if url not in seen:
                seen.add(url)
                unique_urls.append(url)
        
        # Test in parallel batches
        best_result = None
        best_score = 0
        
        batch_size = 15
        for i in range(0, len(unique_urls), batch_size):
            batch = unique_urls[i:i + batch_size]
            tasks = [self._fetch_url(url) for url in batch]
            
            try:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for idx, result in enumerate(results):
                    if isinstance(result, Exception):
                        continue
                    
                    content, status, final_url = result
                    if content and status == 200:
                        title = self._get_title(content)
                        score = self._calculate_privacy_score_advanced(content, final_url, title)
                        
                        if score > best_score:
                            best_score = score
                            best_result = (final_url, content, score)
                            
                            # Early termination for excellent matches
                            if score >= 75:
                                logger.info(f"Found excellent match (score: {score}) at {final_url}")
                                self.stats['strategy_success']['direct_url'] += 1
                                return best_result
            
            except Exception as e:
                logger.error(f"Batch processing error: {e}")
                continue
        
        if best_result and best_score >= 40:
            self.stats['strategy_success']['direct_url'] += 1
            return best_result
        
        return None

    async def _strategy_sitemap(self, base_url: str, domain: str) -> Optional[Tuple[str, str, int]]:
        """Strategy 2: Parse sitemap.xml for privacy policy URLs"""
        logger.info(f"Strategy 2: Checking sitemap for {domain}")
        
        sitemap_urls = [
            f"{base_url}/sitemap.xml",
            f"{base_url}/sitemap_index.xml",
            f"{base_url}/sitemap-index.xml"
        ]
        
        for sitemap_url in sitemap_urls:
            try:
                content, status, _ = await self._fetch_url(sitemap_url)
                if content and status == 200:
                    # Parse XML sitemap
                    try:
                        root = ET.fromstring(content)
                        # Handle namespaces
                        namespaces = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
                        
                        privacy_urls = []
                        for url_elem in root.findall('.//ns:url/ns:loc', namespaces) or root.findall('.//loc'):
                            url_text = url_elem.text
                            if url_text and any(pattern in url_text.lower() for pattern in 
                                              ['privacy', 'legal', 'policy', 'terms']):
                                privacy_urls.append(url_text)
                        
                        if privacy_urls:
                            # Test found URLs
                            tasks = [self._fetch_url(url) for url in privacy_urls[:10]]
                            results = await asyncio.gather(*tasks, return_exceptions=True)
                            
                            best_result = None
                            best_score = 0
                            
                            for result in results:
                                if isinstance(result, tuple) and result[0]:
                                    content, status, final_url = result
                                    if content and status == 200:
                                        title = self._get_title(content)
                                        score = self._calculate_privacy_score_advanced(content, final_url, title)
                                        if score > best_score and score >= 40:
                                            best_score = score
                                            best_result = (final_url, content, score)
                            
                            if best_result:
                                self.stats['strategy_success']['sitemap'] += 1
                                return best_result
                    
                    except ET.ParseError as e:
                        logger.debug(f"Sitemap parse error: {e}")
                        continue
            
            except Exception as e:
                logger.debug(f"Sitemap fetch error: {e}")
                continue
        
        return None

    async def _strategy_robots_txt(self, base_url: str, domain: str) -> Optional[Tuple[str, str, int]]:
        """Strategy 3: Check robots.txt for sitemap or privacy policy hints"""
        logger.info(f"Strategy 3: Checking robots.txt for {domain}")
        
        robots_url = f"{base_url}/robots.txt"
        
        try:
            content, status, _ = await self._fetch_url(robots_url)
            if content and status == 200:
                # Look for sitemap references
                sitemap_urls = re.findall(r'Sitemap:\s*(.+)', content, re.IGNORECASE)
                
                if sitemap_urls:
                    # Try sitemaps found in robots.txt
                    for sitemap_url in sitemap_urls[:3]:
                        sitemap_url = sitemap_url.strip()
                        result = await self._strategy_sitemap(sitemap_url, domain)
                        if result:
                            self.stats['strategy_success']['robots_txt'] += 1
                            return result
        
        except Exception as e:
            logger.debug(f"Robots.txt check error: {e}")
        
        return None

    async def _strategy_dom_scan(self, base_url: str, domain: str) -> Optional[Tuple[str, str, int]]:
        """Strategy 4: Scan homepage DOM for privacy policy links"""
        logger.info(f"Strategy 4: Scanning homepage DOM for {domain}")
        
        try:
            content, status, final_url = await self._fetch_url(base_url)
            if not content or status != 200:
                return None
            
            soup = BeautifulSoup(content, 'html.parser')
            privacy_links = set()
            
            # Find all links
            for link in soup.find_all('a', href=True):
                href = link['href']
                link_text = link.get_text(strip=True).lower()
                href_lower = href.lower()
                
                # Check if link is privacy-related
                privacy_terms = ['privacy', 'legal', 'cookie', 'data protection', 'terms']
                if any(term in href_lower or term in link_text for term in privacy_terms):
                    full_url = urljoin(base_url, href)
                    # Filter out obviously wrong links
                    if not any(exclude in full_url.lower() for exclude in 
                             ['facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
                              'youtube.com', 'pinterest.com', '#', 'javascript:', 'mailto:']):
                        privacy_links.add(full_url)
            
            if privacy_links:
                # Test found links in parallel
                tasks = [self._fetch_url(url) for url in list(privacy_links)[:15]]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                best_result = None
                best_score = 0
                
                for result in results:
                    if isinstance(result, tuple) and result[0]:
                        content, status, final_url = result
                        if content and status == 200:
                            title = self._get_title(content)
                            score = self._calculate_privacy_score_advanced(content, final_url, title)
                            if score > best_score and score >= 40:
                                best_score = score
                                best_result = (final_url, content, score)
                
                if best_result:
                    self.stats['strategy_success']['dom_scan'] += 1
                    return best_result
        
        except Exception as e:
            logger.error(f"DOM scan error: {e}")
        
        return None

    async def fetch_privacy_policy(self, url: str) -> Dict:
        """
        Main entry point: Fetch privacy policy using all available strategies
        Returns: Dict with success status, policy_text, policy_url, score, etc.
        """
        start_time = time.time()
        self.stats['total_requests'] += 1
        
        try:
            # Parse and normalize URL
            if not url.startswith(('http://', 'https://')):
                url = f'https://{url}'
            
            parsed_url = urlparse(url)
            domain = parsed_url.netloc
            base_url = f"{parsed_url.scheme}://{domain}"
            
            logger.info(f"Ultra Fetcher: Processing {domain}")
            
            # Check multi-tier cache
            cached = await self._get_from_memory_cache(domain)
            if cached:
                cached['cached'] = True
                cached['cache_type'] = 'memory'
                return cached
            
            cached = await self._get_from_disk_cache(domain)
            if cached:
                cached['cached'] = True
                cached['cache_type'] = 'disk'
                return cached
            
            self.stats['cache_misses'] += 1
            
            # Try strategies in order of speed/success rate
            strategies = [
                ('direct_urls', self._strategy_direct_urls),
                ('sitemap', self._strategy_sitemap),
                ('robots_txt', self._strategy_robots_txt),
                ('dom_scan', self._strategy_dom_scan)
            ]
            
            for strategy_name, strategy_func in strategies:
                try:
                    result = await strategy_func(base_url, domain)
                    if result:
                        policy_url, content, score = result
                        clean_text = self._extract_clean_text(content)
                        
                        logger.info(f"Extracted {len(clean_text)} characters from {policy_url}")
                        
                        if len(clean_text) >= 50:  # Further reduced minimum for better success
                            response = {
                                'success': True,
                                'policy_url': policy_url,
                                'policy_text': clean_text[:15000],  # Limit size
                                'score': score,
                                'strategy': strategy_name,
                                'fetch_time': time.time() - start_time,
                                'cached': False,
                                'domain': domain
                            }
                            
                            # Save to cache
                            await self._save_to_memory_cache(domain, response)
                            await self._save_to_disk_cache(domain, response)
                            
                            logger.info(f"Success for {domain} via {strategy_name} (score: {score}) in {time.time() - start_time:.2f}s")
                            return response
                        else:
                            logger.warning(f"Content too short ({len(clean_text)} chars) from {policy_url}, trying next strategy")
                
                except Exception as e:
                    logger.error(f"Strategy {strategy_name} error for {domain}: {e}")
                    continue
            
            # All strategies failed
            fetch_time = time.time() - start_time
            logger.warning(f"All strategies failed for {domain} ({fetch_time:.2f}s)")
            
            return {
                'success': False,
                'error': 'Privacy policy not found',
                'domain': domain,
                'fetch_time': fetch_time,
                'strategies_tried': len(strategies)
            }
        
        except Exception as e:
            fetch_time = time.time() - start_time
            logger.error(f"Fatal error for {url}: {e}")
            return {
                'success': False,
                'error': str(e),
                'domain': url,
                'fetch_time': fetch_time
            }

    async def _strategy_javascript_fallback(self, base_url: str, domain: str) -> Optional[Tuple[str, str, int]]:
        """Strategy 6: JavaScript rendering for problematic sites like Instagram/Facebook"""
        logger.info(f"Strategy 6: JavaScript rendering for {domain}")
        
        if not JS_FETCHER_AVAILABLE:
            logger.debug("JavaScript fetcher not available")
            return None
        
        # Only use JavaScript for known problematic sites
        problematic_domains = ['instagram.com', 'facebook.com', 'tiktok.com', 'snapchat.com']
        if domain not in problematic_domains:
            return None
        
        try:
            js_fetcher = await get_js_fetcher()
            if not js_fetcher:
                return None
            
            # Try the known privacy policy URLs with JavaScript
            privacy_urls = [
                f"https://privacycenter.{domain}/policy",
                f"https://www.{domain}/privacy/policy",
                f"https://{domain}/privacy",
                f"https://{domain}/privacy-policy"
            ]
            
            for privacy_url in privacy_urls:
                try:
                    content, status, final_url = await js_fetcher.fetch_with_js(privacy_url)
                    if content and len(content) > 100:
                        # Calculate score
                        score = self._calculate_privacy_score_advanced(content, final_url)
                        if score >= 60:
                            logger.info(f"JavaScript fetch successful for {privacy_url}: {len(content)} chars, score: {score}")
                            return content, final_url, score
                except Exception as e:
                    logger.debug(f"JavaScript fetch failed for {privacy_url}: {e}")
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"JavaScript strategy error for {domain}: {e}")
            return None

    def get_stats(self) -> Dict:
        """Get performance statistics"""
        total_cache_checks = self.stats['memory_hits'] + self.stats['disk_hits'] + self.stats['cache_misses']
        cache_hit_rate = (
            (self.stats['memory_hits'] + self.stats['disk_hits']) / total_cache_checks * 100
            if total_cache_checks > 0 else 0
        )
        
        return {
            'total_requests': self.stats['total_requests'],
            'cache_hit_rate': f"{cache_hit_rate:.1f}%",
            'memory_hits': self.stats['memory_hits'],
            'disk_hits': self.stats['disk_hits'],
            'cache_misses': self.stats['cache_misses'],
            'avg_response_time': f"{self.stats['avg_response_time']:.2f}s",
            'strategy_success': self.stats['strategy_success'],
            'memory_cache_size': len(self.memory_cache),
            'nlp_available': NLP_AVAILABLE
        }


# Global instance
ultra_fetcher = None

async def get_ultra_fetcher() -> UltraPrivacyFetcher:
    """Get or create global ultra fetcher instance"""
    global ultra_fetcher
    if ultra_fetcher is None:
        ultra_fetcher = UltraPrivacyFetcher()
        await ultra_fetcher.__aenter__()
    return ultra_fetcher

