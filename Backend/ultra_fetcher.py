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

# Import Firecrawl fetcher as final fallback for JS-heavy sites
try:
    from firecrawl_fetcher import get_firecrawl_fetcher, FirecrawlFetcher
    FIRECRAWL_AVAILABLE = True
except ImportError:
    FIRECRAWL_AVAILABLE = False
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
                'domain_specific': 0,
                'mobile_fallback': 0,
                'javascript': 0,
                'firecrawl': 0
            }
        }
        
        # Domain-specific knowledge base
        self.domain_patterns = self._load_domain_patterns()
        
        # Mobile/basic version fallback URLs for JS-heavy sites
        self.mobile_fallbacks = self._load_mobile_fallbacks()
        
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
            "{base}/privacystatement", "{base}/PrivacyPolicy", "{base}/Privacy",
            # Facebook/Meta specific URLs
            "{base}/privacy/explanation", "{base}/about/privacy", "{base}/legal/privacy",
            "{base}/policies/privacy", "{base}/policies/privacy-policy", "{base}/privacy/policy",
            "{base}/privacy/update", "{base}/privacy/full", "{base}/privacy/statement"
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
            # IMPORTANT: Mobile/basic URLs are listed FIRST - they work without JavaScript!
            'google.com': {
                'paths': [
                    # Google policies site works well
                    'https://policies.google.com/privacy',
                    'https://policies.google.com/privacy?hl=en',
                    '/policies/privacy',
                    '/intl/en/policies/privacy',
                    '/chrome/privacy'
                ],
                'priority': 10,
                'requires_js': False
            },
            'facebook.com': {
                'paths': [
                    # MOBILE/BASIC versions FIRST - these work without JavaScript!
                    'https://mbasic.facebook.com/privacy/policy/?locale=en_US',
                    'https://mbasic.facebook.com/legal/terms/update',
                    'https://m.facebook.com/privacy/policy/',
                    'https://m.facebook.com/about/privacy/',
                    # Then try full site URLs
                    'https://www.facebook.com/privacy/policy/',
                    'https://www.facebook.com/privacy/explanation/',
                    'https://www.facebook.com/about/privacy/',
                    'https://www.facebook.com/legal/privacy',
                    '/privacy/policy',
                    '/privacy',
                    '/about/privacy'
                ],
                'priority': 10,
                'requires_js': True,
                'try_mobile_first': True  # Flag to try mobile versions first
            },
            'meta.com': {
                'paths': [
                    # Meta redirects to Facebook for privacy
                    'https://mbasic.facebook.com/privacy/policy/?locale=en_US',
                    'https://m.facebook.com/privacy/policy/',
                    'https://www.facebook.com/privacy/policy/',
                    'https://www.meta.com/legal/privacy-policy/',
                    'https://about.meta.com/privacy/',
                    '/privacy/policy',
                    '/privacy',
                    '/legal/privacy'
                ],
                'priority': 10,
                'requires_js': True,
                'try_mobile_first': True
            },
            'instagram.com': {
                'paths': [
                    # Instagram uses Facebook/Meta privacy policy - use mobile versions!
                    'https://mbasic.facebook.com/privacy/policy/?locale=en_US',
                    'https://m.facebook.com/privacy/policy/',
                    'https://www.facebook.com/privacy/policy/',
                    'https://help.instagram.com/519522125107875',
                    'https://privacycenter.instagram.com/policy',
                    '/legal/privacy',
                    '/privacy/policy'
                ],
                'priority': 10,
                'requires_js': True,
                'try_mobile_first': True
            },
            'twitter.com': {
                'paths': [
                    'https://twitter.com/en/privacy',
                    'https://twitter.com/privacy',
                    '/en/privacy',
                    '/privacy',
                    '/privacy-policy'
                ],
                'priority': 10,
                'requires_js': False
            },
            'x.com': {
                'paths': [
                    'https://twitter.com/en/privacy',
                    'https://x.com/en/privacy',
                    '/en/privacy',
                    '/privacy',
                    '/privacy-policy'
                ],
                'priority': 10,
                'requires_js': False
            },
            'linkedin.com': {'paths': ['/legal/privacy-policy', '/privacy', '/privacy-policy'], 'priority': 10},
            'tiktok.com': {
                'paths': [
                    'https://www.tiktok.com/legal/page/row/privacy-policy/en',
                    'https://www.tiktok.com/legal/privacy-policy-us',
                    '/legal/privacy-policy',
                    '/legal/page/row/privacy-policy',
                    '/privacy'
                ],
                'priority': 10,
                'requires_js': True
            },
            'snapchat.com': {
                'paths': [
                    'https://values.snap.com/privacy/privacy-policy',
                    '/privacy/privacy-policy',
                    '/privacy',
                    '/policies/privacy'
                ],
                'priority': 10
            },
            'reddit.com': {'paths': ['/policies/privacy-policy', '/privacy', '/help/privacypolicy'], 'priority': 10},
            'whatsapp.com': {
                'paths': [
                    # WhatsApp legal pages work without JS
                    'https://www.whatsapp.com/legal/privacy-policy',
                    'https://www.whatsapp.com/legal/updates/privacy-policy',
                    '/legal/privacy-policy',
                    '/legal/updates/privacy-policy',
                    '/privacy'
                ],
                'priority': 10,
                'requires_js': False
            },
            'discord.com': {'paths': ['/privacy', '/privacy-policy', '/terms'], 'priority': 10},
            'telegram.org': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'pinterest.com': {'paths': ['/privacy/privacy-policy', '/privacy', '/_/_/policy/privacy-policy'], 'priority': 10},
            'tumblr.com': {'paths': ['/privacy', '/policy/en/privacy'], 'priority': 10},
            
            # Tech Giants
            'microsoft.com': {
                'paths': [
                    'https://privacy.microsoft.com/en-us/privacystatement',
                    '/privacy',
                    '/en-us/privacy',
                    '/privacystatement'
                ],
                'priority': 10
            },
            'apple.com': {
                'paths': [
                    'https://www.apple.com/legal/privacy/en-ww/',
                    '/legal/privacy',
                    '/privacy',
                    '/legal/privacy/en-ww'
                ],
                'priority': 10
            },
            'amazon.com': {
                'paths': [
                    'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496',
                    '/gp/help/customer/display.html?nodeId=468496',
                    '/privacy',
                    '/privacy-policy'
                ],
                'priority': 10
            },
            'github.com': {'paths': ['/privacy', '/site/privacy', 'https://docs.github.com/en/site-policy/privacy-policies'], 'priority': 10},
            'zoom.us': {'paths': ['/privacy', '/privacy-and-legal'], 'priority': 10},
            'dropbox.com': {'paths': ['/privacy', '/terms/privacy'], 'priority': 10},
            'salesforce.com': {'paths': ['/company/privacy', '/privacy', '/legal/privacy'], 'priority': 10},
            'adobe.com': {'paths': ['/privacy', '/privacy/policy', '/legal/privacy'], 'priority': 10},
            'oracle.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'openai.com': {
                'paths': [
                    'https://openai.com/policies/privacy-policy',
                    'https://openai.com/privacy',
                    '/policies/privacy-policy',
                    '/privacy',
                    '/privacy-policy'
                ],
                'priority': 10
            },
            'chatgpt.com': {
                'paths': [
                    # ChatGPT redirects to OpenAI's privacy policy
                    'https://openai.com/policies/privacy-policy',
                    'https://openai.com/privacy',
                    '/privacy',
                    '/privacy-policy'
                ],
                'priority': 10,
                'requires_js': True
            },
            
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
            'steam.com': {
                'paths': [
                    'https://store.steampowered.com/privacy_agreement',
                    '/privacy_agreement',
                    '/privacy'
                ],
                'priority': 10
            },
            'steampowered.com': {
                'paths': [
                    'https://store.steampowered.com/privacy_agreement',
                    '/privacy_agreement',
                    '/privacy_agreement/english'
                ],
                'priority': 10
            },
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
            
            # Design & Productivity Tools
            'canva.com': {'paths': ['/policies/privacy-policy', '/privacy'], 'priority': 10},
            'figma.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10, 'requires_js': True},
            'notion.so': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'asana.com': {'paths': ['/terms/privacy-statement', '/privacy'], 'priority': 10},
            'trello.com': {'paths': ['/privacy', '/legal/privacy'], 'priority': 10},
            'miro.com': {'paths': ['/legal/privacy-policy', '/privacy'], 'priority': 10},
            'airtable.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'monday.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'clickup.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'zapier.com': {'paths': ['/privacy', '/legal/privacy'], 'priority': 10},
            
            # E-commerce
            'shopify.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'etsy.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'ebay.com': {'paths': ['/pages/help/policies/privacy-policy/privacy-policy', '/privacy'], 'priority': 10},
            'wish.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'aliexpress.com': {'paths': ['/privacy', '/help/privacy'], 'priority': 10},
            'walmart.com': {'paths': ['/help/privacy-security', '/privacy'], 'priority': 10},
            'target.com': {'paths': ['/c/privacy-policy/-/N-4sr7l', '/privacy'], 'priority': 10},
            'bestbuy.com': {'paths': ['/legal/privacy-policy', '/privacy'], 'priority': 10},
            
            # Entertainment & Streaming
            'hulu.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'disneyplus.com': {'paths': ['/legal/privacy-policy', '/privacy'], 'priority': 10, 'requires_js': True},
            'hbomax.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'crunchyroll.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'soundcloud.com': {'paths': ['/pages/privacy', '/privacy'], 'priority': 10, 'requires_js': True},
            'vimeo.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'dailymotion.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            
            # News & Media
            'medium.com': {'paths': ['/policy/privacy-policy', '/privacy'], 'priority': 10, 'requires_js': True},
            'substack.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'reuters.com': {'paths': ['/privacy-policy', '/privacy'], 'priority': 10},
            'bloomberg.com': {'paths': ['/notices/privacy', '/privacy'], 'priority': 10},
            'nytimes.com': {'paths': ['/privacy/privacy-policy', '/privacy'], 'priority': 10},
            'washingtonpost.com': {'paths': ['/privacy-policy', '/privacy'], 'priority': 10},
            'bbc.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'cnn.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            
            # Education
            'coursera.org': {'paths': ['/about/privacy', '/privacy'], 'priority': 10},
            'udemy.com': {'paths': ['/terms/privacy', '/privacy'], 'priority': 10},
            'edx.org': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'khanacademy.org': {'paths': ['/about/privacy-policy', '/privacy'], 'priority': 10},
            'duolingo.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'skillshare.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'codecademy.com': {'paths': ['/policy', '/privacy'], 'priority': 10, 'requires_js': True},
            
            # Crypto & Finance
            'coinbase.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'binance.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10, 'requires_js': True},
            'kraken.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'robinhood.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10, 'requires_js': True},
            'venmo.com': {'paths': ['/legal/us-privacy-notice', '/privacy'], 'priority': 10},
            'paypal.com': {'paths': ['/legalhub/privacy/privacy-full', '/privacy'], 'priority': 10},
            'stripe.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            
            # Travel & Booking
            'expedia.com': {'paths': ['/p/support/privacy', '/privacy'], 'priority': 10},
            'booking.com': {'paths': ['/general.en-gb.html?label=privacy', '/privacy'], 'priority': 10},
            'airbnb.com': {'paths': ['/terms/privacy_policy', '/privacy'], 'priority': 10},
            'tripadvisor.com': {'paths': ['/PrivacyPolicy', '/privacy'], 'priority': 10},
            'kayak.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'hotels.com': {'paths': ['/customer_care/privacy_policy', '/privacy'], 'priority': 10},
            
            # Other Popular
            'weather.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'yelp.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'glassdoor.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'indeed.com': {'paths': ['/legal/privacy', '/privacy'], 'priority': 10},
            'quora.com': {'paths': ['/about/privacy', '/privacy'], 'priority': 10, 'requires_js': True},
            'stackoverflow.com': {'paths': ['/legal/privacy-policy', '/privacy'], 'priority': 10},
            'producthunt.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'dribbble.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            'behance.net': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10},
            
            # Known JavaScript-heavy sites (custom frameworks, Next.js, React, etc.)
            'tle-eliminators.com': {'paths': ['/terms-and-conditions', '/privacy', '/terms'], 'priority': 10, 'requires_js': True},
            'leetcode.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'codeforces.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'hackerrank.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'interviewbit.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'geeksforgeeks.org': {'paths': ['/privacy-policy', '/privacy'], 'priority': 10, 'requires_js': True},
            'vercel.app': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'netlify.app': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'railway.app': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
            'render.com': {'paths': ['/privacy', '/privacy-policy'], 'priority': 10, 'requires_js': True},
        }
    
    def _load_mobile_fallbacks(self) -> Dict:
        """
        Load mobile/basic/lite URL patterns for JavaScript-heavy sites.
        These versions often work without JavaScript and are easier to scrape.
        
        Strategies:
        1. mbasic.* - Facebook's basic version (no JS)
        2. m.* - Mobile versions (often simpler)
        3. lite.* - Lite versions for low-bandwidth
        4. mobile.* - Mobile subdomains
        5. amp.* - AMP versions (simplified HTML)
        6. Simple/basic HTML policy pages on the same domain
        """
        return {
            # Meta/Facebook family - use mbasic for best results
            'facebook.com': [
                'https://mbasic.facebook.com/privacy/policy/?locale=en_US',
                'https://mbasic.facebook.com/about/privacy/',
                'https://m.facebook.com/privacy/policy/',
                'https://m.facebook.com/about/privacy/',
            ],
            'meta.com': [
                'https://mbasic.facebook.com/privacy/policy/?locale=en_US',
                'https://m.facebook.com/privacy/policy/',
            ],
            'instagram.com': [
                'https://mbasic.facebook.com/privacy/policy/?locale=en_US',
                'https://m.facebook.com/privacy/policy/',
                'https://help.instagram.com/519522125107875',
            ],
            'messenger.com': [
                'https://mbasic.facebook.com/privacy/policy/?locale=en_US',
                'https://m.facebook.com/privacy/policy/',
            ],
            'threads.net': [
                'https://mbasic.facebook.com/privacy/policy/?locale=en_US',
                'https://help.instagram.com/threads/privacy',
            ],
            'whatsapp.com': [
                'https://www.whatsapp.com/legal/privacy-policy',  # WhatsApp's page works without JS
                'https://mbasic.facebook.com/privacy/policy/?locale=en_US',
            ],
            
            # Twitter/X - mobile versions
            'twitter.com': [
                'https://mobile.twitter.com/en/privacy',
                'https://twitter.com/en/privacy',
            ],
            'x.com': [
                'https://mobile.twitter.com/en/privacy',
                'https://twitter.com/en/privacy',
            ],
            
            # TikTok - try different regions
            'tiktok.com': [
                'https://www.tiktok.com/legal/page/row/privacy-policy/en',
                'https://www.tiktok.com/legal/privacy-policy-us',
                'https://www.tiktok.com/legal/page/eea/privacy-policy/en',
                'https://www.tiktok.com/legal/privacy-policy-row',
            ],
            
            # LinkedIn - mobile and simplified versions
            'linkedin.com': [
                'https://www.linkedin.com/legal/privacy-policy',
                'https://mobile.linkedin.com/legal/privacy-policy',
                'https://www.linkedin.com/legal/l/privacy-policy',
            ],
            
            # Pinterest - mobile version
            'pinterest.com': [
                'https://policy.pinterest.com/en/privacy-policy',
                'https://www.pinterest.com/_/_/policy/privacy-policy/',
            ],
            
            # Snapchat
            'snapchat.com': [
                'https://values.snap.com/privacy/privacy-policy',
                'https://snap.com/en-US/privacy/privacy-policy',
            ],
            
            # Reddit - old reddit often works better
            'reddit.com': [
                'https://www.reddit.com/policies/privacy-policy',
                'https://old.reddit.com/wiki/privacypolicy',
                'https://www.redditinc.com/policies/privacy-policy',
            ],
            
            # Discord
            'discord.com': [
                'https://discord.com/privacy',
                'https://discordapp.com/privacy',
            ],
            
            # Spotify - direct policy page
            'spotify.com': [
                'https://www.spotify.com/us/legal/privacy-policy/',
                'https://www.spotify.com/legal/privacy-policy/',
            ],
            
            # Netflix
            'netflix.com': [
                'https://help.netflix.com/legal/privacy',
                'https://www.netflix.com/privacy',
            ],
            
            # Amazon - help pages work without JS
            'amazon.com': [
                'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496',
                'https://www.amazon.com/privacy',
            ],
            
            # Twitch
            'twitch.tv': [
                'https://www.twitch.tv/p/legal/privacy-notice/',
                'https://www.twitch.tv/p/legal/privacy-policy/',
            ],
            
            # YouTube - Google policies
            'youtube.com': [
                'https://policies.google.com/privacy',
                'https://www.youtube.com/t/privacy',
            ],
            
            # Uber
            'uber.com': [
                'https://www.uber.com/legal/en/document/?name=privacy-notice&country=united-states&lang=en',
                'https://www.uber.com/legal/privacy/users/',
            ],
            
            # Airbnb
            'airbnb.com': [
                'https://www.airbnb.com/terms/privacy_policy',
                'https://www.airbnb.com/help/article/2855',
            ],
            
            # GitHub - docs site works well
            'github.com': [
                'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
                'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement',
                'https://github.com/site/privacy',
            ],
            
            # Microsoft
            'microsoft.com': [
                'https://privacy.microsoft.com/en-us/privacystatement',
                'https://www.microsoft.com/en-us/privacy/privacystatement',
            ],
            
            # Apple
            'apple.com': [
                'https://www.apple.com/legal/privacy/en-ww/',
                'https://www.apple.com/privacy/privacy-policy/',
            ],
            
            # Google
            'google.com': [
                'https://policies.google.com/privacy?hl=en',
                'https://policies.google.com/privacy',
            ],
            
            # Zoom
            'zoom.us': [
                'https://explore.zoom.us/en/privacy/',
                'https://zoom.us/privacy',
            ],
            
            # Dropbox
            'dropbox.com': [
                'https://www.dropbox.com/privacy',
                'https://www.dropbox.com/terms/privacy',
            ],
            
            # Slack
            'slack.com': [
                'https://slack.com/trust/privacy/privacy-policy',
                'https://slack.com/privacy-policy',
            ],
            
            # Design & Productivity
            'canva.com': [
                'https://www.canva.com/policies/privacy-policy/',
                'https://www.canva.com/en/privacy/',
            ],
            'figma.com': [
                'https://www.figma.com/legal/privacy/',
                'https://www.figma.com/privacy/',
            ],
            'notion.so': [
                'https://www.notion.so/privacy',
                'https://www.notion.so/Privacy-Policy-3468d120cf614d4c9014c09f6adc9091',
            ],
            'asana.com': [
                'https://asana.com/terms/privacy-statement',
                'https://asana.com/privacy',
            ],
            'trello.com': [
                'https://trello.com/privacy',
                'https://www.atlassian.com/legal/privacy-policy',
            ],
            'zapier.com': [
                'https://zapier.com/privacy',
                'https://zapier.com/legal/privacy',
            ],
        }

    def _normalize_domain_for_lookup(self, domain: str) -> str:
        """Normalize domain for dictionary lookups (remove www. prefix)"""
        domain = domain.lower().strip()
        # Remove www. prefix for consistent lookups
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain

    def _get_cache_key(self, domain: str) -> str:
        """Generate cache key for domain"""
        normalized = self._normalize_domain_for_lookup(domain)
        return hashlib.sha256(normalized.encode()).hexdigest()

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
        last_error_type = None
        last_status_code = None
        
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
                    last_status_code = response.status
                    
                    if response.status == 200:
                        if 'html' in content_type or 'text' in content_type or 'xml' in content_type:
                            content = await response.text(errors='ignore')
                            # Limit content size
                            if len(content) > 1000000:  # 1MB limit
                                content = content[:1000000]
                            return content, response.status, str(response.url)
                    
                    return None, response.status, str(response.url)
                    
            except asyncio.TimeoutError:
                last_error_type = 'timeout'
                if attempt < max_retries:
                    await asyncio.sleep(1.0 * (attempt + 1))  # Longer delays
                    continue
            except aiohttp.ClientConnectionError as e:
                last_error_type = 'connection_error'
                logger.debug(f"Connection error for {url}: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
            except aiohttp.ClientSSLError as e:
                last_error_type = 'ssl_error'
                logger.debug(f"SSL error for {url}: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
            except Exception as e:
                last_error_type = 'unknown_error'
                logger.debug(f"Fetch error for {url}: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
        
        # Store last error info for diagnostic purposes
        self._last_fetch_error = {
            'url': url,
            'error_type': last_error_type,
            'status_code': last_status_code
        }
        return None, None, url
    
    def _detect_content_issues(self, content: str, url: str) -> Dict:
        """Detect common content issues like JavaScript rendering requirements, bot protection, etc."""
        issues = {
            'requires_javascript': False,
            'has_bot_protection': False,
            'is_captcha_protected': False,
            'is_login_required': False,
            'is_geo_blocked': False,
            'is_empty_or_minimal': False,
            'detected_issues': []
        }
        
        if not content:
            issues['is_empty_or_minimal'] = True
            issues['detected_issues'].append('empty_content')
            return issues
        
        content_lower = content.lower()
        
        # Check for minimal content (likely JS-rendered)
        if len(content.strip()) < 500:
            issues['is_empty_or_minimal'] = True
            issues['detected_issues'].append('minimal_content')
        
        # JavaScript detection patterns
        js_patterns = [
            'enable javascript',
            'javascript is required',
            'javascript is disabled',
            'please enable javascript',
            'this page requires javascript',
            'you need to enable javascript',
            'javascript must be enabled',
            '<noscript>',
            'react-root',
            '__NEXT_DATA__',
            'window.__INITIAL_STATE__',
            'data-reactroot',
            'id="app"',  # Common SPA mount point with no content
        ]
        
        if any(pattern in content_lower for pattern in js_patterns):
            # Check if there's actually content or just JS shell
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(content, 'html.parser')
            text_content = soup.get_text(strip=True)
            if len(text_content) < 1000:
                issues['requires_javascript'] = True
                issues['detected_issues'].append('javascript_required')
        
        # Bot protection detection
        bot_patterns = [
            'cloudflare',
            'challenge-platform',
            'cf-browser-verification',
            'just a moment',
            'checking your browser',
            'security check',
            'ddos protection',
            'ray id:',
            'access denied',
            'please wait while we verify',
            'bot detected',
            'automated access',
            'incapsula',
            'sucuri',
            'akamai',
            'imperva',
            'distil networks',
        ]
        
        if any(pattern in content_lower for pattern in bot_patterns):
            issues['has_bot_protection'] = True
            issues['detected_issues'].append('bot_protection')
        
        # CAPTCHA detection
        captcha_patterns = [
            'captcha',
            'recaptcha',
            'hcaptcha',
            'verify you are human',
            'prove you are not a robot',
            'i\'m not a robot',
            'complete the security check',
        ]
        
        if any(pattern in content_lower for pattern in captcha_patterns):
            issues['is_captcha_protected'] = True
            issues['detected_issues'].append('captcha_required')
        
        # Login detection
        login_patterns = [
            'please log in',
            'please sign in',
            'login required',
            'you must be logged in',
            'sign in to continue',
            'authentication required',
        ]
        
        if any(pattern in content_lower for pattern in login_patterns):
            issues['is_login_required'] = True
            issues['detected_issues'].append('login_required')
        
        # Geo-blocking detection
        geo_patterns = [
            'not available in your region',
            'not available in your country',
            'geo-restricted',
            'blocked in your location',
            'content is not available',
        ]
        
        if any(pattern in content_lower for pattern in geo_patterns):
            issues['is_geo_blocked'] = True
            issues['detected_issues'].append('geo_blocked')
        
        return issues
    
    async def _generate_detailed_error(self, url: str, base_url: str, domain: str, normalized_domain: str, strategies_tried: int, 
                                       override_code: str = None, override_message: str = None) -> Dict:
        """Generate detailed error information with user-friendly messages
        
        Args:
            url: Original URL requested
            base_url: Base URL of the domain
            domain: Domain name
            normalized_domain: Normalized domain for lookups
            strategies_tried: Number of strategies attempted
            override_code: Optional - Force a specific error code
            override_message: Optional - Force a specific error message
        """
        
        # Default error info
        error_info = {
            'success': False,
            'domain': normalized_domain,
            'strategies_tried': strategies_tried,
            'url_attempted': url
        }
        
        # If override code is provided, use it immediately
        if override_code:
            custom_suggestions = []
            if override_code == 'JAVASCRIPT_REQUIRED':
                custom_suggestions = [
                    f"Visit {url} directly in your browser",
                    "The content loads dynamically and requires a real browser",
                    "Try using a different website for analysis"
                ]
            error_info.update({
                'error': override_message or 'Fetch failed',
                'error_code': override_code,
                'error_reason': override_message or 'Could not retrieve content',
                'user_message': override_message or f"Unable to fetch content from {domain}",
                'suggestions': custom_suggestions if custom_suggestions else [f"Visit {url} directly in your browser"]
            })
            return error_info
        
        # Try to fetch the homepage to detect specific issues
        content, status, _ = await self._fetch_url(base_url, max_retries=1)
        
        # Check for specific HTTP status codes
        if status is not None:
            if status == 403:
                error_info.update({
                    'error': 'Access denied by the website',
                    'error_code': 'ACCESS_DENIED',
                    'error_reason': 'The website is blocking automated requests.',
                    'user_message': f"⛔ Access Denied: {domain} is blocking our request. This usually means the site has bot protection enabled (like Cloudflare). Try accessing the privacy policy directly at the website.",
                    'suggestions': [
                        f"Visit {base_url}/privacy directly in your browser",
                        "Search for the privacy policy on their website",
                        "Try again later as the protection may be temporary"
                    ]
                })
                return error_info
            
            elif status == 404:
                error_info.update({
                    'error': 'Privacy policy page not found',
                    'error_code': 'PAGE_NOT_FOUND',
                    'error_reason': 'The website does not have a privacy policy at common URL paths.',
                    'user_message': f"🔍 Not Found: We couldn't locate a privacy policy on {domain}. The website may use an unusual URL for their policy, or may not have one publicly available.",
                    'suggestions': [
                        "Check the website's footer for a privacy policy link",
                        "Look in their Terms of Service or Legal pages",
                        "Contact the website directly to request their privacy policy"
                    ]
                })
                return error_info
            
            elif status == 429:
                error_info.update({
                    'error': 'Rate limited by the website',
                    'error_code': 'RATE_LIMITED',
                    'error_reason': 'We sent too many requests and got temporarily blocked.',
                    'user_message': f"⏳ Rate Limited: {domain} has temporarily blocked requests. Please wait a few minutes and try again.",
                    'suggestions': [
                        "Wait 2-5 minutes before trying again",
                        "The block is usually temporary"
                    ]
                })
                return error_info
            
            elif status >= 500:
                error_info.update({
                    'error': 'Website server error',
                    'error_code': 'SERVER_ERROR',
                    'error_reason': 'The website is experiencing technical issues.',
                    'user_message': f"🔧 Server Error: {domain} is experiencing technical difficulties. This is not a problem on our end.",
                    'suggestions': [
                        "Try again in a few minutes",
                        "The website may be under maintenance"
                    ]
                })
                return error_info
        
        # Check for content-based issues
        if content:
            issues = self._detect_content_issues(content, base_url)
            
            if issues['has_bot_protection']:
                error_info.update({
                    'error': 'Website has bot protection',
                    'error_code': 'BOT_PROTECTION',
                    'error_reason': 'The website uses security measures (like Cloudflare) that block automated access.',
                    'user_message': f"🛡️ Bot Protection: {domain} uses advanced security (likely Cloudflare or similar) that prevents automated access. The privacy policy content cannot be retrieved automatically.",
                    'suggestions': [
                        f"Visit the website directly and look for their privacy policy",
                        "Common locations: footer links, 'Legal' or 'Privacy' menu items",
                        "You may need to complete a CAPTCHA on the website first"
                    ]
                })
                return error_info
            
            if issues['is_captcha_protected']:
                error_info.update({
                    'error': 'CAPTCHA verification required',
                    'error_code': 'CAPTCHA_REQUIRED',
                    'error_reason': 'The website requires human verification (CAPTCHA) to access content.',
                    'user_message': f"🤖 CAPTCHA Required: {domain} requires human verification to access. We cannot automatically bypass CAPTCHA challenges.",
                    'suggestions': [
                        "Visit the website directly in your browser",
                        "Complete the CAPTCHA and then try accessing the privacy policy"
                    ]
                })
                return error_info
            
            if issues['requires_javascript']:
                # Check if this is a known JS-heavy site
                domain_pattern = self.domain_patterns.get(normalized_domain, {})
                is_known_js_site = domain_pattern.get('requires_js', False)
                
                error_info.update({
                    'error': 'JavaScript rendering required',
                    'error_code': 'JAVASCRIPT_REQUIRED',
                    'error_reason': 'The privacy policy page is built with JavaScript frameworks (like React or Angular) and requires a full browser to load.',
                    'user_message': f"📜 JavaScript Required: {domain}'s privacy policy page uses JavaScript to render content. Our current fetcher cannot execute JavaScript to retrieve the full content.",
                    'suggestions': [
                        f"Visit {base_url}/privacy in your browser",
                        "The content loads dynamically and requires a real browser",
                        "We're working on improving support for JavaScript-heavy sites"
                    ]
                })
                return error_info
            
            if issues['is_login_required']:
                error_info.update({
                    'error': 'Login required to view content',
                    'error_code': 'LOGIN_REQUIRED',
                    'error_reason': 'The website requires users to log in to view the privacy policy.',
                    'user_message': f"🔐 Login Required: {domain} requires you to be logged in to view their privacy policy. This is unusual for privacy policies.",
                    'suggestions': [
                        "Log in to the website and navigate to the privacy policy",
                        "Contact the website if you believe the privacy policy should be public"
                    ]
                })
                return error_info
            
            if issues['is_geo_blocked']:
                error_info.update({
                    'error': 'Content geo-restricted',
                    'error_code': 'GEO_BLOCKED',
                    'error_reason': 'The website is blocking access based on geographic location.',
                    'user_message': f"🌍 Geo-Blocked: {domain} appears to restrict access based on location. The content may not be available in your region.",
                    'suggestions': [
                        "The website may have regional restrictions",
                        "Try accessing from a different network or location"
                    ]
                })
                return error_info
        
        # Check last fetch error if available
        if hasattr(self, '_last_fetch_error') and self._last_fetch_error:
            last_error = self._last_fetch_error
            
            if last_error.get('error_type') == 'timeout':
                error_info.update({
                    'error': 'Connection timeout',
                    'error_code': 'TIMEOUT',
                    'error_reason': 'The website took too long to respond.',
                    'user_message': f"⏱️ Timeout: {domain} is taking too long to respond. The server may be slow or experiencing high traffic.",
                    'suggestions': [
                        "Wait a few minutes and try again",
                        "The website may be experiencing high load"
                    ]
                })
                return error_info
            
            elif last_error.get('error_type') == 'connection_error':
                error_info.update({
                    'error': 'Connection failed',
                    'error_code': 'CONNECTION_FAILED',
                    'error_reason': 'Could not establish a connection to the website.',
                    'user_message': f"🔌 Connection Failed: Unable to connect to {domain}. The website may be down or the URL may be incorrect.",
                    'suggestions': [
                        "Verify the website URL is correct",
                        "Check if the website is accessible in your browser",
                        "The website may be temporarily offline"
                    ]
                })
                return error_info
            
            elif last_error.get('error_type') == 'ssl_error':
                error_info.update({
                    'error': 'SSL/Security certificate error',
                    'error_code': 'SSL_ERROR',
                    'error_reason': 'The website has an invalid or expired security certificate.',
                    'user_message': f"🔒 SSL Error: {domain} has a security certificate issue. This may indicate a problem with the website's configuration.",
                    'suggestions': [
                        "The website may have an expired SSL certificate",
                        "Try accessing the website directly to see if there are security warnings"
                    ]
                })
                return error_info
        
        # Default fallback error
        error_info.update({
            'error': 'Privacy policy not found',
            'error_code': 'NOT_FOUND',
            'error_reason': 'We searched multiple common locations but could not find the privacy policy.',
            'user_message': f"❓ Not Found: We couldn't locate a privacy policy on {domain} after trying {strategies_tried} different search strategies. The website may not have a publicly accessible privacy policy, or it may be in an unusual location.",
            'suggestions': [
                f"Check {base_url} directly and look in the footer",
                "Look for 'Legal', 'Privacy', or 'Terms' links on the website",
                "The privacy policy may be embedded within Terms of Service"
            ]
        })
        
        return error_info

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
        
        # Get domain-specific patterns first (use normalized domain for lookup)
        normalized_domain = self._normalize_domain_for_lookup(domain)
        test_urls = []
        if normalized_domain in self.domain_patterns:
            pattern = self.domain_patterns[normalized_domain]
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
        
        logger.info(f"Testing {len(unique_urls)} direct URLs for {domain}")
        
        # For JavaScript-required sites, limit direct URL attempts to avoid wasting time
        # Use normalized_domain (already computed above)
        domain_pattern = self.domain_patterns.get(normalized_domain, {})
        if domain_pattern.get('requires_js', False):
            # Only test top 10 URLs for JS-required sites, then move to JS strategy
            unique_urls = unique_urls[:10]
            logger.info(f"Limited to top {len(unique_urls)} URLs for JS-required site {domain}")
        
        # Test in parallel batches with timeout
        best_result = None
        best_score = 0
        
        batch_size = 10  # Reduced batch size for faster failure
        for i in range(0, len(unique_urls), batch_size):
            batch = unique_urls[i:i + batch_size]
            
            # Create tasks with timeout wrapper
            async def fetch_with_timeout(url):
                try:
                    return await asyncio.wait_for(self._fetch_url(url), timeout=8.0)
                except asyncio.TimeoutError:
                    logger.debug(f"Timeout for {url}")
                    return None, None, url
                except Exception as e:
                    logger.debug(f"Error fetching {url}: {e}")
                    return None, None, url
            
            tasks = [fetch_with_timeout(url) for url in batch]
            
            try:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for idx, result in enumerate(results):
                    if isinstance(result, Exception):
                        continue
                    
                    content, status, final_url = result
                    if content and status == 200:
                        title = self._get_title(content)
                        score = self._calculate_privacy_score_advanced(content, final_url, title)
                        
                        logger.debug(f"URL {final_url}: score={score}, content_len={len(content)}")
                        
                        if score > best_score:
                            best_score = score
                            best_result = (final_url, content, score)
                            
                            # Early termination for excellent matches
                            if score >= 75:
                                logger.info(f"✓ Found excellent match (score: {score}) at {final_url}")
                                self.stats['strategy_success']['direct_url'] += 1
                                return best_result
            
            except Exception as e:
                logger.error(f"Batch processing error: {e}")
                continue
        
        if best_result and best_score >= 40:
            logger.info(f"✓ Direct URL strategy found match (score: {best_score})")
            self.stats['strategy_success']['direct_url'] += 1
            return best_result
        
        logger.debug(f"Direct URL strategy found no valid matches (best score: {best_score})")
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
    
    async def _strategy_mobile_fallback(self, base_url: str, domain: str) -> Optional[Tuple[str, str, int]]:
        """
        Strategy 5: Try mobile/basic versions of JavaScript-heavy sites.
        
        Many modern sites like TikTok, Instagram, etc. require JavaScript to render.
        This strategy tries alternative versions (mobile, basic, lite) that work without JS:
        - mbasic.* - Facebook's basic version (no JS required)
        - m.* - Mobile versions (often simpler HTML)
        - Mobile-specific privacy policy pages
        - AMP versions
        """
        logger.info(f"Strategy 5: Trying mobile fallback for {domain}")
        
        # Normalize domain for lookup
        normalized_domain = self._normalize_domain_for_lookup(domain)
        
        # Check if we have mobile fallbacks for this domain
        mobile_urls = self.mobile_fallbacks.get(normalized_domain, [])
        
        if not mobile_urls:
            # Generate generic mobile fallbacks for any domain
            parsed = urlparse(base_url)
            scheme = parsed.scheme
            domain_parts = parsed.netloc.split('.')
            
            # Remove www if present
            if domain_parts[0] == 'www' and len(domain_parts) > 2:
                base_domain = '.'.join(domain_parts[1:])
            else:
                base_domain = parsed.netloc
            
            # Try common mobile patterns
            mobile_urls = [
                f"{scheme}://m.{base_domain}/privacy",
                f"{scheme}://mobile.{base_domain}/privacy",
                f"{scheme}://m.{base_domain}/privacy-policy",
                f"{scheme}://mobile.{base_domain}/privacy-policy",
                f"{scheme}://m.{base_domain}/legal/privacy",
            ]
        
        logger.debug(f"Trying {len(mobile_urls)} mobile URLs for {domain}")
        
        best_result = None
        best_score = 0
        
        # Try each mobile URL
        for mobile_url in mobile_urls:
            try:
                content, status, final_url = await self._fetch_url(mobile_url, max_retries=1)
                
                if content and status == 200:
                    title = self._get_title(content)
                    score = self._calculate_privacy_score_advanced(content, final_url, title)
                    
                    logger.debug(f"Mobile URL {final_url}: score={score}, content_len={len(content)}")
                    
                    if score > best_score:
                        best_score = score
                        best_result = (final_url, content, score)
                        
                        # Early termination for excellent matches
                        if score >= 60:
                            logger.info(f"✓ Found excellent mobile match (score: {score}) at {final_url}")
                            self.stats['strategy_success']['mobile_fallback'] += 1
                            return best_result
            
            except Exception as e:
                logger.debug(f"Mobile URL {mobile_url} failed: {e}")
                continue
        
        if best_result and best_score >= 35:
            logger.info(f"✓ Mobile fallback strategy found match (score: {best_score})")
            self.stats['strategy_success']['mobile_fallback'] += 1
            return best_result
        
        logger.debug(f"Mobile fallback strategy found no valid matches (best score: {best_score})")
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
            normalized_domain = self._normalize_domain_for_lookup(domain)
            url_path = parsed_url.path.lower()
            
            # Check if URL is already a privacy/legal policy page (direct link)
            # Expanded list to include terms, conditions, legal pages, etc.
            privacy_path_indicators = [
                # Privacy-specific paths
                '/privacy', '/privacy-policy', '/privacy_policy', '/privacypolicy',
                '/privacy-notice', '/privacy-statement', '/data-protection', 
                '/cookie-policy', '/legal/privacy', '/policies/privacy',
                '/terms/privacy', '/about/privacy', '/help/privacy',
                # Terms and conditions paths (often contain privacy info)
                '/terms', '/terms-and-conditions', '/terms-of-service', '/tos',
                '/terms-conditions', '/termsandconditions', '/termsofservice',
                '/terms_and_conditions', '/terms_of_service',
                # Legal paths
                '/legal', '/legal/terms', '/policies', '/policy',
                # GDPR/CCPA specific
                '/gdpr', '/ccpa', '/your-privacy-choices',
                # Other common legal paths
                '/user-agreement', '/eula', '/license', '/disclaimer'
            ]
            
            is_direct_privacy_url = any(indicator in url_path for indicator in privacy_path_indicators)
            
            # Also treat as direct URL if the path has multiple segments (not just homepage)
            # e.g., /some-page/terms or /legal/privacy - indicates a specific page
            path_segments = [seg for seg in url_path.split('/') if seg]
            is_specific_page = len(path_segments) > 0 and not url_path.endswith('/')
            
            # If user provided a direct URL to a specific page, try fetching it first
            if is_direct_privacy_url or is_specific_page:
                logger.info(f"Detected direct/specific URL: {url} - fetching directly first")
                
                # Check if this domain is known to require JavaScript
                domain_pattern = self.domain_patterns.get(normalized_domain, {})
                if domain_pattern.get('requires_js', False):
                    logger.warning(f"Domain {normalized_domain} is known to require JavaScript")
                    base_url = f"{parsed_url.scheme}://{domain}"
                    return await self._generate_detailed_error(
                        url, base_url, domain, normalized_domain, 0,
                        override_code='JAVASCRIPT_REQUIRED',
                        override_message=f"📜 JavaScript Required: {normalized_domain} is a JavaScript-heavy site that requires a browser to render content. Our fetcher cannot execute JavaScript. Please visit {url} directly in your browser."
                    )
                
                # Try to fetch the URL directly first
                content, status, final_url = await self._fetch_url(url)
                
                if content and status == 200:
                    title = self._get_title(content)
                    clean_text = self._extract_clean_text(content)
                    content_length = len(clean_text)
                    raw_content_length = len(content)
                    score = self._calculate_privacy_score_advanced(content, final_url, title)
                    
                    logger.info(f"Direct fetch result: content_length={content_length}, raw_html={raw_content_length}, score={score}, title='{title[:50] if title else 'None'}'")
                    
                    # FIRST: Check if this looks like a JS-rendered page (before accepting content)
                    # This prevents accepting garbage shell content from SPAs
                    content_issues = self._detect_content_issues(content)
                    content_lower = content.lower()
                    
                    # Comprehensive SPA framework detection patterns
                    spa_indicators = [
                        # Next.js
                        '__NEXT_DATA__' in content,
                        'id="__next"' in content_lower,
                        '_next/static' in content_lower,
                        # Nuxt.js
                        '__NUXT__' in content,
                        '_nuxt/' in content_lower,
                        # React
                        'data-reactroot' in content_lower,
                        'id="root"></div>' in content_lower,
                        'react-dom' in content_lower and content_length < 3000,
                        # Vue.js
                        'id="app"></div>' in content_lower,
                        '__VUE__' in content,
                        'vue.runtime' in content_lower,
                        # Angular
                        'ng-version' in content_lower,
                        'angular.io' in content_lower,
                        '<app-root' in content_lower,
                        # Gatsby
                        '___gatsby' in content_lower,
                        'gatsby-' in content_lower and content_length < 3000,
                        # Svelte/SvelteKit
                        'sveltekit' in content_lower,
                        '__sveltekit' in content_lower,
                        # Remix
                        '__remixContext' in content,
                        # Astro
                        'astro-' in content_lower and content_length < 3000,
                        # Vite
                        '@vite/client' in content_lower,
                        # Redux/State management
                        'window.__INITIAL_STATE__' in content,
                        'window.__PRELOADED_STATE__' in content,
                        # Generic SPA indicators
                        'window.__APP_DATA__' in content,
                        'window.__DATA__' in content,
                        # Empty body with just root div
                        '<body><div id=' in content_lower and content_length < 500,
                    ]
                    
                    spa_count = sum(spa_indicators)
                    
                    # Also check if the raw HTML is much larger than text content (JS-heavy)
                    text_to_html_ratio = content_length / max(raw_content_length, 1)
                    is_js_heavy = text_to_html_ratio < 0.05 and raw_content_length > 10000  # Less than 5% text
                    
                    logger.info(f"SPA detection: indicators={spa_count}, content_length={content_length}, raw_html={raw_content_length}, text_ratio={text_to_html_ratio:.2%}, score={score}")
                    
                    # Detect SPA shell: multiple conditions with aggressive detection
                    is_spa_shell = (
                        (spa_count >= 1 and content_length < 8000) or  # SPA with low text content
                        (spa_count >= 1 and score < 20) or  # SPA with low privacy score
                        (spa_count >= 2) or  # Multiple SPA indicators = definitely SPA
                        is_js_heavy or  # Very low text-to-HTML ratio
                        content_issues.get('requires_javascript', False)
                    )
                    
                    if is_spa_shell:
                        logger.warning(f"Direct URL appears to be a JS-rendered SPA: {url} (content_length={content_length}, spa_indicators={spa_count}, score={score})")
                        base_url = f"{parsed_url.scheme}://{domain}"
                        return await self._generate_detailed_error(
                            url, base_url, domain, normalized_domain, 0,
                            override_code='JAVASCRIPT_REQUIRED',
                            override_message=f"📜 JavaScript Required: The page at {url} uses a JavaScript framework (like React/Next.js) to render content. Our fetcher cannot execute JavaScript. Please visit the link directly in your browser to view the content."
                        )
                    
                    # For user-provided direct URLs, be lenient if we have good content
                    min_content_length = 200  # Require minimum content to ensure it's not a shell
                    min_score = 10 if is_direct_privacy_url else 5
                    
                    if content_length >= min_content_length and score >= min_score:
                        response = {
                            'success': True,
                            'policy_url': final_url,
                            'policy_text': clean_text[:15000],
                            'score': score,
                            'strategy': 'direct_fetch',
                            'fetch_time': time.time() - start_time,
                            'cached': False,
                            'domain': normalized_domain
                        }
                        # Save to cache
                        await self._save_to_memory_cache(normalized_domain, response)
                        await self._save_to_disk_cache(normalized_domain, response)
                        logger.info(f"✓ Direct fetch successful for {url} (score: {score}, chars: {content_length}) in {time.time() - start_time:.2f}s")
                        return response
                    
                    if content_length < min_content_length:
                        logger.warning(f"Direct URL returned too little content ({content_length} chars): {url}")
                    else:
                        logger.info(f"Direct URL fetch returned low score ({score}), trying other strategies...")
                
                elif status and status != 200:
                    logger.warning(f"Direct URL fetch returned HTTP {status}: {url}")
                else:
                    logger.warning(f"Direct URL fetch returned no content: {url}")
            
            # Normalize domain - some sites require www
            www_required_domains = ['facebook.com', 'instagram.com', 'meta.com']
            if normalized_domain in www_required_domains and not domain.startswith('www.'):
                # Keep original for domain lookup, but use www for base_url
                base_url = f"{parsed_url.scheme}://www.{domain}"
            else:
                base_url = f"{parsed_url.scheme}://{domain}"
            
            logger.info(f"Ultra Fetcher: Processing {domain} (normalized: {normalized_domain}, base_url: {base_url})")
            
            # Check multi-tier cache (use normalized domain for consistency)
            cached = await self._get_from_memory_cache(normalized_domain)
            if cached:
                cached['cached'] = True
                cached['cache_type'] = 'memory'
                return cached
            
            cached = await self._get_from_disk_cache(normalized_domain)
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
            
            # Add mobile fallback and JavaScript fallback for sites that require it
            # Use normalized_domain for dictionary lookup
            domain_pattern = self.domain_patterns.get(normalized_domain, {})
            
            # For JS-heavy sites, add mobile fallback BEFORE JavaScript fallback
            # Also check if we have mobile fallbacks for this specific domain
            if domain_pattern.get('requires_js', False) or normalized_domain in self.mobile_fallbacks:
                strategies.append(('mobile_fallback', self._strategy_mobile_fallback))
            
            # Add JavaScript fallback as last resort (for sites like Facebook)
            if domain_pattern.get('requires_js', False):
                strategies.append(('javascript', self._strategy_javascript_fallback))
            
            # Add Firecrawl as FINAL fallback (uses API credits, so only when all else fails)
            # Firecrawl works for any domain, but we only use it as a last resort
            if FIRECRAWL_AVAILABLE:
                strategies.append(('firecrawl', self._strategy_firecrawl_fallback))
            
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
                                'domain': normalized_domain
                            }
                            
                            # Save to cache (use normalized_domain for consistency)
                            await self._save_to_memory_cache(normalized_domain, response)
                            await self._save_to_disk_cache(normalized_domain, response)
                            
                            logger.info(f"Success for {domain} via {strategy_name} (score: {score}) in {time.time() - start_time:.2f}s")
                            return response
                        else:
                            logger.warning(f"Content too short ({len(clean_text)} chars) from {policy_url}, trying next strategy")
                
                except Exception as e:
                    logger.error(f"Strategy {strategy_name} error for {domain}: {e}")
                    continue
            
            # All dynamic strategies failed - try static fallback for major sites
            fetch_time = time.time() - start_time
            logger.warning(f"All strategies failed for {domain} ({fetch_time:.2f}s), trying static fallback")
            
            # Check if we have a static fallback for this domain
            static_result = await self._get_static_fallback(normalized_domain)
            if static_result:
                logger.info(f"Using static fallback for {domain}")
                static_result['fetch_time'] = fetch_time
                return static_result
            
            # Generate detailed error information
            error_info = await self._generate_detailed_error(url, base_url, domain, normalized_domain, len(strategies))
            error_info['fetch_time'] = fetch_time
            
            return error_info
        
        except Exception as e:
            fetch_time = time.time() - start_time
            logger.error(f"Fatal error for {url}: {e}")
            return {
                'success': False,
                'error': str(e),
                'domain': url,
                'fetch_time': fetch_time
            }

    async def _get_static_fallback(self, domain: str) -> Optional[Dict]:
        """
        Provide static fallback privacy policy summaries for major sites.
        This is used when all dynamic fetching strategies fail (e.g., due to JavaScript requirements).
        The text is a condensed summary of their actual privacy policies.
        """
        # Static fallback data for major sites
        static_policies = {
            'facebook.com': {
                'policy_url': 'https://www.facebook.com/privacy/policy/',
                'policy_text': '''Facebook Privacy Policy Summary

Facebook (Meta) collects extensive personal information including:

INFORMATION YOU PROVIDE:
- Account information (name, email, phone number, birthday)
- Content you create or share (posts, photos, videos, messages)
- Payment information for purchases
- Profile information and settings

AUTOMATICALLY COLLECTED INFORMATION:
- Device information (hardware, software, device identifiers)
- Location data from GPS, WiFi, and other signals
- Browsing activity and interactions within Meta products
- Cookie data and tracking technologies
- Network and connection information

INFORMATION FROM THIRD PARTIES:
- Data from advertisers about your activity on other websites
- Information from other users (contacts, photos, tags)
- Data from partners who use Facebook's business tools

HOW INFORMATION IS USED:
- Personalizing content and advertisements
- Improving and developing products
- Promoting safety and security
- Communicating with you about products and services
- Research and innovation

DATA SHARING:
- Shared within Meta companies (Instagram, WhatsApp, Messenger)
- Shared with third-party partners and advertisers
- Shared with service providers and vendors
- May be shared for legal reasons or to prevent harm

YOUR RIGHTS:
- Access your data through "Download Your Information"
- Delete or deactivate your account
- Manage privacy settings
- Opt out of certain data collection
- Under GDPR/CCPA: access, correction, deletion, portability rights

DATA RETENTION:
Meta retains information as long as necessary for the purposes described, 
which may be for the life of your account plus additional time for legal compliance.

Last reviewed: 2024''',
                'score': 85
            },
            'instagram.com': {
                'policy_url': 'https://www.facebook.com/privacy/policy/',
                'policy_text': '''Instagram Privacy Policy Summary

Instagram uses the same privacy policy as Facebook/Meta.

DATA COLLECTED:
- Profile information (username, bio, profile photo)
- Content you post (photos, videos, stories, reels)
- Messages and communications
- Device and usage information
- Location data
- Contacts (if you sync your phone)
- Payment information for shopping features

DATA USAGE:
- Personalizing your feed and ads
- Connecting you with friends
- Providing shopping features
- Analytics and performance improvement
- Safety and security

DATA SHARING:
- Shared with Meta companies (Facebook, WhatsApp)
- Shared with advertisers and partners
- Shared with content creators for insights

YOUR RIGHTS:
- Download your data
- Delete content or account
- Manage ad preferences
- Control who sees your content
- GDPR/CCPA rights apply

Last reviewed: 2024''',
                'score': 85
            },
            'meta.com': {
                'policy_url': 'https://www.facebook.com/privacy/policy/',
                'policy_text': '''Meta Privacy Policy Summary

Meta's privacy policy covers all Meta products including Facebook, Instagram, WhatsApp, and Messenger.

See Facebook and Instagram entries for detailed information about data collection across Meta platforms.

Key points:
- Extensive data collection across all Meta products
- Cross-platform data sharing within Meta family
- Targeted advertising based on your activity
- Your data may be shared with many third parties
- Various privacy settings available to manage data

YOUR RIGHTS:
- Access and download your data
- Delete your account
- Manage ad preferences
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 80
            },
            'google.com': {
                'policy_url': 'https://policies.google.com/privacy',
                'policy_text': '''Google Privacy Policy Summary

Google collects substantial amounts of data across all Google services.

DATA COLLECTED:
- Account information (name, email, payment info)
- Search history and browsing activity
- Location history and GPS data
- Voice and audio recordings (Google Assistant)
- YouTube watch history and preferences
- Gmail content (for features, not ads since 2017)
- Photos and videos in Google Photos
- Documents in Google Drive
- Device information and identifiers

HOW DATA IS USED:
- Personalizing search results and content
- Targeted advertising across Google and partner sites
- Improving Google products and services
- Security and fraud prevention
- Developing new services

DATA SHARING:
- With other Google services
- With third-party partners and advertisers
- With service providers
- For legal compliance

PRIVACY CONTROLS:
- Google Privacy Dashboard (myaccount.google.com)
- Activity controls for search, location, YouTube
- Ad personalization settings
- Data download and deletion tools

YOUR RIGHTS:
- Access and export your data
- Delete specific data or entire account
- Opt out of personalized ads
- GDPR/CCPA compliance

Last reviewed: 2024''',
                'score': 80
            },
            'amazon.com': {
                'policy_url': 'https://www.amazon.com/privacy',
                'policy_text': '''Amazon Privacy Policy Summary

Amazon collects data related to your shopping and service usage.

DATA COLLECTED:
- Account and payment information
- Purchase history
- Browsing and search history on Amazon
- Product reviews and ratings
- Alexa voice recordings
- Kindle reading data
- Prime Video watch history
- Device information

HOW DATA IS USED:
- Processing orders and payments
- Personalized recommendations
- Advertising on and off Amazon
- Improving products and services
- Fraud prevention

DATA SHARING:
- With Amazon subsidiaries (AWS, Whole Foods, etc.)
- With third-party sellers
- With service providers
- For advertising purposes

YOUR RIGHTS:
- Access your data
- Delete certain information
- Opt out of interest-based ads
- Manage Alexa privacy settings
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 75
            },
            'twitter.com': {
                'policy_url': 'https://twitter.com/en/privacy',
                'policy_text': '''Twitter/X Privacy Policy Summary

Twitter (now X) collects data related to your account and activity.

DATA COLLECTED:
- Account information (name, email, phone)
- Tweets, likes, retweets, and messages
- Device and browser information
- Location data (if enabled)
- Advertising data
- Contact information (if synced)

HOW DATA IS USED:
- Providing the service
- Personalized content and ads
- Analytics and improvements
- Safety and security

DATA SHARING:
- With advertising partners
- With service providers
- For legal compliance
- Business transfers

YOUR RIGHTS:
- Download your data archive
- Delete tweets or deactivate account
- Manage privacy settings
- GDPR/CCPA rights apply

Last reviewed: 2024''',
                'score': 70
            },
            'x.com': {
                'policy_url': 'https://x.com/en/privacy',
                'policy_text': '''X (formerly Twitter) Privacy Policy Summary

X collects data related to your account and activity.

DATA COLLECTED:
- Account information
- Posts, likes, and messages
- Device information
- Location data
- Advertising data

HOW DATA IS USED:
- Service provision
- Personalization
- Advertising
- Analytics

YOUR RIGHTS:
- Download data
- Delete account
- Manage privacy settings
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 70
            },
            'tiktok.com': {
                'policy_url': 'https://www.tiktok.com/legal/privacy-policy',
                'policy_text': '''TikTok Privacy Policy Summary

TikTok collects extensive data about users and their content.

DATA COLLECTED:
- Account and profile information
- Videos you create and watch
- Messages and comments
- Device identifiers and technical data
- Location information
- Keystroke patterns and clipboard content
- Face and voice data from videos

HOW DATA IS USED:
- Personalizing your For You feed
- Targeted advertising
- Content moderation
- Analytics and research

DATA SHARING:
- With advertising partners
- With service providers
- Data may be accessible from China (ByteDance is a Chinese company)

CONCERNS:
- Extensive data collection
- Potential access by Chinese government
- Algorithm influences content exposure

YOUR RIGHTS:
- Download data
- Delete account
- Manage privacy settings
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 85
            },
            'vercel.com': {
                'policy_url': 'https://vercel.com/legal/privacy-policy',
                'policy_text': '''Vercel Privacy Policy Summary

Vercel collects data to provide their hosting and deployment platform.

DATA COLLECTED:
- Account information (name, email, company)
- Payment and billing information
- Usage data and analytics
- Log data and IP addresses
- Cookies and tracking data

HOW DATA IS USED:
- Providing the hosting service
- Processing payments
- Customer support
- Analytics and improvements
- Security and fraud prevention

DATA SHARING:
- With service providers
- For legal compliance
- With your consent

YOUR RIGHTS:
- Access your data
- Delete your account
- Manage cookie preferences
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 70
            },
            'linkedin.com': {
                'policy_url': 'https://www.linkedin.com/legal/privacy-policy',
                'policy_text': '''LinkedIn Privacy Policy Summary

LinkedIn (Microsoft) collects extensive professional and personal data.

DATA COLLECTED:
- Profile information (name, work history, education)
- Contact information
- Job applications and searches
- Messages and communications
- Connection data
- Device and usage information
- Location data

HOW DATA IS USED:
- Professional networking features
- Job recommendations
- Content personalization
- Targeted advertising
- Analytics

DATA SHARING:
- With Microsoft companies
- With employers (job applications)
- With advertisers
- With service providers

YOUR RIGHTS:
- Download your data
- Delete your account
- Manage privacy settings
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 80
            },
            'whatsapp.com': {
                'policy_url': 'https://www.whatsapp.com/legal/privacy-policy',
                'policy_text': '''WhatsApp Privacy Policy Summary

WhatsApp (Meta) collects data for messaging and communication.

DATA COLLECTED:
- Phone number and contacts
- Profile information
- Messages (end-to-end encrypted)
- Device and connection information
- Location data
- Usage and log information

HOW DATA IS USED:
- Providing messaging service
- Connecting with contacts
- Security and verification
- Business messaging features

DATA SHARING:
- Shared with Meta companies (Facebook, Instagram)
- With business accounts you message
- With service providers

YOUR RIGHTS:
- Download your data
- Delete your account
- Manage privacy settings
- GDPR/CCPA rights

Note: Messages are end-to-end encrypted, but metadata is shared with Meta.

Last reviewed: 2024''',
                'score': 75
            },
            'netflix.com': {
                'policy_url': 'https://help.netflix.com/legal/privacy',
                'policy_text': '''Netflix Privacy Policy Summary

Netflix collects data for streaming and personalization.

DATA COLLECTED:
- Account and payment information
- Viewing history and preferences
- Search history
- Device information
- Location data

HOW DATA IS USED:
- Streaming service provision
- Content recommendations
- Account management
- Service improvement

DATA SHARING:
- With service providers
- For content licensing
- For legal compliance

YOUR RIGHTS:
- View your data
- Download viewing history
- Manage profile settings
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 65
            },
            'github.com': {
                'policy_url': 'https://docs.github.com/en/site-policy/privacy-policies',
                'policy_text': '''GitHub Privacy Policy Summary

GitHub (Microsoft) collects data for developer collaboration.

DATA COLLECTED:
- Account information
- Repository content and code
- Contribution history
- Device and usage information
- Payment information (for paid features)

HOW DATA IS USED:
- Providing GitHub services
- Code hosting and collaboration
- Security scanning
- Product improvement

DATA SHARING:
- With Microsoft companies
- With service providers
- For legal compliance
- Public repositories are public

YOUR RIGHTS:
- Download your data
- Delete your account
- Manage repository visibility
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 70
            },
            'spotify.com': {
                'policy_url': 'https://www.spotify.com/legal/privacy-policy/',
                'policy_text': '''Spotify Privacy Policy Summary

Spotify collects data for music streaming and personalization.

DATA COLLECTED:
- Account and payment information
- Listening history
- Playlists and saved content
- Device and usage data
- Location information
- Voice data (if using voice features)

HOW DATA IS USED:
- Music streaming service
- Personalized recommendations
- Wrapped and analytics features
- Targeted advertising (free tier)

DATA SHARING:
- With music labels and artists
- With advertisers (free tier)
- With service providers

YOUR RIGHTS:
- Download your data
- Delete your account
- Manage privacy settings
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 70
            },
            'steampowered.com': {
                'policy_url': 'https://store.steampowered.com/privacy_agreement',
                'policy_text': '''Steam Privacy Policy Summary

Steam (Valve Corporation) collects data for gaming and digital distribution.

DATA COLLECTED:
- Account information (username, email, password)
- Payment and billing information
- Game library and playtime data
- Achievements and statistics
- Friends list and social features
- Chat and voice communications
- Hardware information (for Steam Hardware Survey)
- IP address and location data

HOW DATA IS USED:
- Operating the Steam platform
- Processing game purchases
- Providing multiplayer and social features
- Anti-cheat and fraud prevention
- Customer support
- Analytics and improvements

DATA SHARING:
- With game publishers (for games you play)
- With service providers
- For legal compliance
- Community features are public (by default)

YOUR RIGHTS:
- Download your data
- Delete your account
- Manage privacy settings
- Hide game activity
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 75
            },
            'steam.com': {
                'policy_url': 'https://store.steampowered.com/privacy_agreement',
                'policy_text': '''Steam Privacy Policy Summary

Steam (Valve Corporation) collects data for gaming and digital distribution.

DATA COLLECTED:
- Account and payment information
- Game library and playtime
- Achievements and statistics
- Friends list and social features
- Hardware information
- IP address and location

HOW DATA IS USED:
- Platform operation
- Game purchases
- Social features
- Anti-cheat systems

DATA SHARING:
- With game publishers
- With service providers

YOUR RIGHTS:
- Download your data
- Delete account
- Manage privacy settings
- GDPR/CCPA rights

Last reviewed: 2024''',
                'score': 75
            }
        }
        
        if domain in static_policies:
            data = static_policies[domain]
            return {
                'success': True,
                'policy_url': data['policy_url'],
                'policy_text': data['policy_text'],
                'score': data['score'],
                'strategy': 'static_fallback',
                'cached': False,
                'domain': domain,
                'is_fallback': True,
                'fallback_note': 'This is a pre-analyzed summary. Visit the policy URL for the full current policy.'
            }
        
        return None

    async def _strategy_javascript_fallback(self, base_url: str, domain: str) -> Optional[Tuple[str, str, int]]:
        """Strategy 5: JavaScript rendering for problematic sites like Instagram/Facebook"""
        logger.info(f"Strategy 5: JavaScript rendering for {domain}")
        
        if not JS_FETCHER_AVAILABLE:
            logger.debug("JavaScript fetcher not available")
            return None
        
        # Only use JavaScript for known problematic sites
        problematic_domains = ['instagram.com', 'facebook.com', 'tiktok.com', 'snapchat.com', 'meta.com']
        if domain not in problematic_domains:
            return None
        
        try:
            js_fetcher = await get_js_fetcher()
            if not js_fetcher:
                logger.warning("JavaScript fetcher not initialized")
                return None
            
            # Build list of URLs to try - use domain-specific patterns if available
            privacy_urls = []
            
            # Get domain-specific URLs first (use normalized domain for lookup)
            normalized_domain = self._normalize_domain_for_lookup(domain)
            if normalized_domain in self.domain_patterns:
                pattern = self.domain_patterns[normalized_domain]
                for path in pattern['paths']:
                    if path.startswith('http'):
                        privacy_urls.append(path)
                    else:
                        privacy_urls.append(urljoin(base_url, path))
            
            # Add common fallback URLs (base_url already handles www correctly, no need to add it manually)
            common_urls = [
                f"{base_url}/privacy",
                f"{base_url}/privacy-policy",
                f"{base_url}/privacy/policy"
            ]
            
            for url in common_urls:
                if url not in privacy_urls:
                    privacy_urls.append(url)
            
            # Remove duplicates while preserving order
            seen = set()
            unique_urls = []
            for url in privacy_urls:
                if url not in seen:
                    seen.add(url)
                    unique_urls.append(url)
            
            logger.info(f"Trying {len(unique_urls)} URLs with JavaScript rendering")
            
            for privacy_url in unique_urls[:10]:  # Limit to top 10 to avoid timeout
                try:
                    logger.debug(f"JavaScript fetch attempt: {privacy_url}")
                    content, status, final_url = await js_fetcher.fetch_with_js(privacy_url, wait_time=15)
                    if content and len(content) > 500:  # Require substantial content
                        # Calculate score
                        title = self._get_title(content)
                        score = self._calculate_privacy_score_advanced(content, final_url, title)
                        logger.info(f"JavaScript fetch result for {privacy_url}: {len(content)} chars, score: {score}")
                        if score >= 40:  # Lower threshold for JS-rendered content
                            logger.info(f"✓ JavaScript fetch successful: {final_url} (score: {score})")
                            return (final_url, content, score)
                except Exception as e:
                    logger.debug(f"JavaScript fetch failed for {privacy_url}: {e}")
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"JavaScript strategy error for {domain}: {e}")
            return None

    async def _strategy_firecrawl_fallback(self, base_url: str, domain: str) -> Optional[Tuple[str, str, int]]:
        """
        Strategy 6: Firecrawl API fallback for JavaScript-heavy sites
        
        This is the FINAL fallback strategy that uses Firecrawl's managed browser
        infrastructure. It handles:
        - JavaScript rendering
        - Anti-bot bypass
        - CAPTCHA solving
        - Proxy rotation
        
        NOTE: This uses API credits, so it's only called when all other strategies fail.
        """
        logger.info(f"Strategy 6: Firecrawl API fallback for {domain}")
        
        if not FIRECRAWL_AVAILABLE:
            logger.debug("Firecrawl fetcher not available")
            return None
        
        try:
            firecrawl_fetcher = await get_firecrawl_fetcher()
            if not firecrawl_fetcher or not firecrawl_fetcher.is_available():
                logger.debug("Firecrawl fetcher not initialized or API key not configured")
                return None
            
            # Build list of URLs to try - use domain-specific patterns if available
            privacy_urls = []
            
            # Get domain-specific URLs first (use normalized domain for lookup)
            normalized_domain = self._normalize_domain_for_lookup(domain)
            if normalized_domain in self.domain_patterns:
                pattern = self.domain_patterns[normalized_domain]
                for path in pattern['paths']:
                    if path.startswith('http'):
                        privacy_urls.append(path)
                    else:
                        privacy_urls.append(urljoin(base_url, path))
            
            # Add common fallback URLs
            common_urls = [
                f"{base_url}/privacy",
                f"{base_url}/privacy-policy",
                f"{base_url}/privacy/policy",
                f"{base_url}/legal/privacy"
            ]
            
            for url in common_urls:
                if url not in privacy_urls:
                    privacy_urls.append(url)
            
            # Remove duplicates while preserving order
            seen = set()
            unique_urls = []
            for url in privacy_urls:
                if url not in seen:
                    seen.add(url)
                    unique_urls.append(url)
            
            logger.info(f"Trying {len(unique_urls)} URLs with Firecrawl API")
            
            # Only try first URL to conserve API credits
            for privacy_url in unique_urls[:1]:
                try:
                    logger.debug(f"Firecrawl fetch attempt: {privacy_url}")
                    content, status, final_url = await firecrawl_fetcher.fetch_with_firecrawl(privacy_url)
                    
                    if content and len(content) > 500:  # Require substantial content
                        # Calculate score
                        title = self._get_title(content) if '<title>' in content.lower() else ''
                        score = self._calculate_privacy_score_advanced(content, final_url, title)
                        
                        logger.info(f"Firecrawl result for {privacy_url}: {len(content)} chars, score: {score}")
                        
                        if score >= 30:  # Lower threshold since Firecrawl returns cleaner content
                            self.stats['strategy_success']['firecrawl'] += 1
                            logger.info(f"✓ Firecrawl fetch successful: {final_url} (score: {score})")
                            return (final_url, content, score)
                            
                except Exception as e:
                    logger.debug(f"Firecrawl fetch failed for {privacy_url}: {e}")
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"Firecrawl strategy error for {domain}: {e}")
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