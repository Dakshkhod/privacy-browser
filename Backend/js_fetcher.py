#!/usr/bin/env python3
"""
JavaScript-enabled fetcher for sites that require browser rendering
"""
import asyncio
import logging
from typing import Optional, Tuple
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

logger = logging.getLogger(__name__)

class JavaScriptFetcher:
    """Fetcher that can handle JavaScript-heavy sites"""
    
    def __init__(self):
        self.driver = None
        self._setup_driver()
    
    def _setup_driver(self):
        """Setup Chrome driver with optimized settings"""
        try:
            chrome_options = Options()
            chrome_options.add_argument('--headless')  # Run in background
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # Use webdriver-manager to handle Chrome driver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # Hide automation indicators
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            logger.info("JavaScript fetcher initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize JavaScript fetcher: {e}")
            self.driver = None
    
    async def fetch_with_js(self, url: str, wait_time: int = 10) -> Tuple[Optional[str], Optional[int], Optional[str]]:
        """Fetch URL with JavaScript rendering"""
        if not self.driver:
            return None, None, url
        
        try:
            # Navigate to URL
            self.driver.get(url)
            
            # Wait for page to load
            WebDriverWait(self.driver, wait_time).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Additional wait for dynamic content
            await asyncio.sleep(3)
            
            # Get page source
            content = self.driver.page_source
            
            # Get final URL (after redirects)
            final_url = self.driver.current_url
            
            # Get status (approximate)
            status = 200 if content else 404
            
            logger.info(f"JavaScript fetch successful for {url}: {len(content)} chars")
            return content, status, final_url
            
        except TimeoutException:
            logger.warning(f"Timeout waiting for {url}")
            return None, 408, url
        except WebDriverException as e:
            logger.error(f"WebDriver error for {url}: {e}")
            return None, 500, url
        except Exception as e:
            logger.error(f"Unexpected error fetching {url}: {e}")
            return None, 500, url
    
    def close(self):
        """Close the driver"""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("JavaScript fetcher closed")
            except:
                pass

# Global instance
js_fetcher = None

async def get_js_fetcher() -> Optional[JavaScriptFetcher]:
    """Get or create global JavaScript fetcher instance"""
    global js_fetcher
    if js_fetcher is None:
        js_fetcher = JavaScriptFetcher()
    return js_fetcher
