#!/usr/bin/env python3
"""
Firecrawl API Fetcher - Final fallback for JavaScript-heavy sites
Uses Firecrawl's managed browser infrastructure for reliable scraping
"""
import asyncio
import logging
import os
import time
from typing import Optional, Tuple, Dict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Try to import Firecrawl SDK
try:
    from firecrawl import Firecrawl
    FIRECRAWL_SDK_AVAILABLE = True
except ImportError:
    FIRECRAWL_SDK_AVAILABLE = False
    logger.warning("Firecrawl SDK not installed. Run: pip install firecrawl-py")


class FirecrawlFetcher:
    """
    Firecrawl API fetcher for JavaScript-heavy sites.
    
    This is designed as a FINAL FALLBACK when all other methods fail.
    It uses Firecrawl's managed browser infrastructure which handles:
    - JavaScript rendering
    - Anti-bot bypass
    - CAPTCHA solving
    - Proxy rotation
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Firecrawl fetcher.
        
        Args:
            api_key: Firecrawl API key. If not provided, reads from FIRECRAWL_API_KEY env var.
        """
        self.api_key = api_key or os.environ.get('FIRECRAWL_API_KEY')
        self.client = None
        self.available = False
        
        # Usage tracking for monitoring API credit consumption
        self.usage_stats = {
            'total_calls': 0,
            'successful_calls': 0,
            'failed_calls': 0,
            'credits_used_estimate': 0,  # 1 credit per scrape
            'last_call_time': None,
            'calls_this_month': 0,
            'month_start': datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        }
        
        self._setup_client()
    
    def _setup_client(self):
        """Setup Firecrawl client"""
        if not FIRECRAWL_SDK_AVAILABLE:
            logger.warning("Firecrawl SDK not available - install with: pip install firecrawl-py")
            return
        
        if not self.api_key:
            logger.info("FIRECRAWL_API_KEY not configured - Firecrawl fallback disabled")
            return
        
        try:
            self.client = Firecrawl(api_key=self.api_key)
            self.available = True
            logger.info("✓ Firecrawl fetcher initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Firecrawl client: {e}")
            self.available = False
    
    def _reset_monthly_counter(self):
        """Reset monthly counter if we're in a new month"""
        current_month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if current_month_start > self.usage_stats['month_start']:
            self.usage_stats['calls_this_month'] = 0
            self.usage_stats['month_start'] = current_month_start
            logger.info("Firecrawl monthly usage counter reset")
    
    async def fetch_with_firecrawl(
        self, 
        url: str, 
        timeout: int = 30
    ) -> Tuple[Optional[str], Optional[int], Optional[str]]:
        """
        Fetch URL using Firecrawl API.
        
        Args:
            url: URL to fetch
            timeout: Request timeout in seconds
            
        Returns:
            Tuple of (content, status_code, final_url)
            - content: HTML or markdown content
            - status_code: HTTP status code (200 for success)
            - final_url: Final URL after redirects
        """
        if not self.available or not self.client:
            logger.debug("Firecrawl not available, skipping")
            return None, None, url
        
        # Reset monthly counter if needed
        self._reset_monthly_counter()
        
        # Check if we're approaching free tier limit (500/month)
        if self.usage_stats['calls_this_month'] >= 480:
            logger.warning(f"Approaching Firecrawl free tier limit: {self.usage_stats['calls_this_month']}/500 calls this month")
        
        self.usage_stats['total_calls'] += 1
        self.usage_stats['last_call_time'] = datetime.now()
        
        try:
            logger.info(f"🔥 Firecrawl fetch attempt: {url}")
            
            # Run the synchronous Firecrawl call in a thread pool to not block async
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.client.scrape(
                    url,
                    formats=['markdown', 'html']
                )
            )
            
            if result:
                # Extract content - prefer markdown for cleaner output
                content = None
                
                # Handle different response formats
                if hasattr(result, 'markdown') and result.markdown:
                    content = result.markdown
                    logger.debug("Using markdown content from Firecrawl")
                elif hasattr(result, 'html') and result.html:
                    content = result.html
                    logger.debug("Using HTML content from Firecrawl")
                elif isinstance(result, dict):
                    content = result.get('markdown') or result.get('html') or result.get('content')
                
                if content and len(content) > 100:
                    self.usage_stats['successful_calls'] += 1
                    self.usage_stats['calls_this_month'] += 1
                    self.usage_stats['credits_used_estimate'] += 1
                    
                    # Get final URL if available
                    final_url = url
                    if hasattr(result, 'metadata') and result.metadata:
                        final_url = getattr(result.metadata, 'sourceURL', url) or url
                    elif isinstance(result, dict) and 'metadata' in result:
                        final_url = result['metadata'].get('sourceURL', url)
                    
                    logger.info(f"✓ Firecrawl fetch successful: {len(content)} chars from {final_url}")
                    logger.info(f"  API usage this month: {self.usage_stats['calls_this_month']}/500 (free tier)")
                    
                    return content, 200, final_url
                else:
                    logger.warning(f"Firecrawl returned insufficient content for {url}")
                    self.usage_stats['failed_calls'] += 1
                    return None, 204, url
            else:
                logger.warning(f"Firecrawl returned empty result for {url}")
                self.usage_stats['failed_calls'] += 1
                return None, 404, url
                
        except Exception as e:
            error_msg = str(e)
            self.usage_stats['failed_calls'] += 1
            
            # Handle specific error cases
            if 'rate limit' in error_msg.lower():
                logger.error(f"Firecrawl rate limit exceeded: {e}")
                return None, 429, url
            elif 'unauthorized' in error_msg.lower() or 'invalid api key' in error_msg.lower():
                logger.error(f"Firecrawl API key invalid: {e}")
                self.available = False  # Disable further attempts
                return None, 401, url
            else:
                logger.error(f"Firecrawl fetch error for {url}: {e}")
                return None, 500, url
    
    def get_usage_stats(self) -> Dict:
        """Get usage statistics for monitoring"""
        self._reset_monthly_counter()
        return {
            'available': self.available,
            'total_calls': self.usage_stats['total_calls'],
            'successful_calls': self.usage_stats['successful_calls'],
            'failed_calls': self.usage_stats['failed_calls'],
            'success_rate': (
                f"{(self.usage_stats['successful_calls'] / self.usage_stats['total_calls'] * 100):.1f}%"
                if self.usage_stats['total_calls'] > 0 else "N/A"
            ),
            'calls_this_month': self.usage_stats['calls_this_month'],
            'free_tier_remaining': max(0, 500 - self.usage_stats['calls_this_month']),
            'last_call': (
                self.usage_stats['last_call_time'].isoformat()
                if self.usage_stats['last_call_time'] else None
            )
        }
    
    def is_available(self) -> bool:
        """Check if Firecrawl is available for use"""
        return self.available and self.client is not None


# Global instance
_firecrawl_fetcher: Optional[FirecrawlFetcher] = None


async def get_firecrawl_fetcher() -> Optional[FirecrawlFetcher]:
    """Get or create global Firecrawl fetcher instance"""
    global _firecrawl_fetcher
    if _firecrawl_fetcher is None:
        _firecrawl_fetcher = FirecrawlFetcher()
    return _firecrawl_fetcher


def get_firecrawl_stats() -> Dict:
    """Get Firecrawl usage statistics"""
    if _firecrawl_fetcher:
        return _firecrawl_fetcher.get_usage_stats()
    return {'available': False, 'reason': 'Not initialized'}
