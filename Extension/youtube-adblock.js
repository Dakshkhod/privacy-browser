/**
 * Privacy Browser - YouTube Ad Blocking Module
 * 
 * Brave-style system to block YouTube in-video ads by:
 * 1. Intercepting ad-related network requests (via declarativeNetRequest)
 * 2. Detecting and skipping ads via player state monitoring
 * 3. Removing ad UI elements
 * 
 * Does NOT:
 * - Modify video streams
 * - Interfere with DRM
 * - Break player controls
 */

(function() {
    'use strict';
    
    // Only run on YouTube
    if (!window.location.hostname.includes('youtube.com')) return;
    
    const config = {
        skipDelay: 100,           // ms to wait before attempting skip
        checkInterval: 500,       // ms between ad checks
        maxSkipAttempts: 10,      // max attempts to skip an ad
        debug: false              // set to true for console logs
    };
    
    let skipAttempts = 0;
    let lastAdTime = 0;
    
    function log(...args) {
        if (config.debug) {
            console.log('[Privacy Browser YT]', ...args);
        }
    }
    
    // ============================================
    // PART 1: Ad Detection
    // ============================================
    
    function isAdPlaying() {
        // Method 1: Check for ad-specific player classes
        const player = document.querySelector('.html5-video-player');
        if (player) {
            if (player.classList.contains('ad-showing') ||
                player.classList.contains('ad-interrupting')) {
                return true;
            }
        }
        
        // Method 2: Check for ad overlay elements
        const adOverlay = document.querySelector('.ytp-ad-player-overlay, .ytp-ad-module');
        if (adOverlay && adOverlay.offsetParent !== null) {
            return true;
        }
        
        // Method 3: Check for skip button presence
        const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
        if (skipButton && skipButton.offsetParent !== null) {
            return true;
        }
        
        // Method 4: Check for ad text indicators
        const adText = document.querySelector('.ytp-ad-text, .ytp-ad-preview-container');
        if (adText && adText.offsetParent !== null) {
            return true;
        }
        
        return false;
    }
    
    function getAdType() {
        // Skippable ad
        const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
        if (skipButton && skipButton.offsetParent !== null) {
            return 'skippable';
        }
        
        // Unskippable ad (has countdown)
        const adDuration = document.querySelector('.ytp-ad-duration-remaining');
        if (adDuration) {
            return 'unskippable';
        }
        
        // Overlay ad
        const overlay = document.querySelector('.ytp-ad-overlay-container');
        if (overlay && overlay.offsetParent !== null) {
            return 'overlay';
        }
        
        return 'unknown';
    }
    
    // ============================================
    // PART 2: Ad Skipping/Removal
    // ============================================
    
    function clickSkipButton() {
        const skipSelectors = [
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern',
            '.ytp-skip-ad-button',
            'button.ytp-ad-skip-button-modern',
            '.ytp-ad-skip-button-container button',
            '[class*="skip"] button',
            '.videoAdUiSkipButton'
        ];
        
        for (const selector of skipSelectors) {
            const button = document.querySelector(selector);
            if (button && button.offsetParent !== null) {
                button.click();
                log('Clicked skip button:', selector);
                return true;
            }
        }
        return false;
    }
    
    function skipUnskippableAd() {
        // For unskippable ads, we can try to speed through by seeking to the end
        // This works because ads have their own video element
        const video = document.querySelector('video.html5-main-video');
        const player = document.querySelector('.html5-video-player');
        
        if (!video || !player) return false;
        
        // Only do this if an ad is actually playing
        if (!player.classList.contains('ad-showing')) return false;
        
        // Check if this is truly an ad video (ads are typically short)
        if (video.duration && video.duration < 120 && video.duration > 0) {
            // Seek to near the end of the ad
            const targetTime = Math.max(0, video.duration - 0.1);
            if (video.currentTime < targetTime) {
                video.currentTime = targetTime;
                log('Seeked unskippable ad to end');
                return true;
            }
        }
        
        return false;
    }
    
    function removeOverlayAds() {
        const overlaySelectors = [
            '.ytp-ad-overlay-container',
            '.ytp-ad-overlay-slot',
            '.ytp-ad-text-overlay',
            '.ytp-ad-overlay-image',
            '.ytp-ad-overlay-close-button'
        ];
        
        overlaySelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'none';
                log('Hidden overlay:', selector);
            });
        });
    }
    
    function closeAdInfoDialog() {
        // Close "Why this ad?" or similar dialogs
        const closeButtons = document.querySelectorAll(
            '.ytp-ad-info-dialog-close-button, ' +
            '.ytp-ad-feedback-dialog-close-button'
        );
        closeButtons.forEach(btn => btn.click());
    }
    
    // ============================================
    // PART 3: Player State Interception
    // ============================================
    
    function interceptPlayerAds() {
        // Try to intercept the YouTube player API to prevent ad loading
        if (window.ytInitialPlayerResponse) {
            try {
                // Remove ad-related data from initial player response
                const response = window.ytInitialPlayerResponse;
                if (response.adPlacements) {
                    delete response.adPlacements;
                    log('Removed adPlacements from initial response');
                }
                if (response.playerAds) {
                    delete response.playerAds;
                    log('Removed playerAds from initial response');
                }
                if (response.adSlots) {
                    delete response.adSlots;
                    log('Removed adSlots from initial response');
                }
            } catch (e) {
                log('Error intercepting player response:', e);
            }
        }
    }
    
    // Inject script to intercept XMLHttpRequest for ad data
    function injectAdInterceptor() {
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                // Intercept fetch to block ad-related requests
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                    const url = args[0]?.url || args[0];
                    if (typeof url === 'string') {
                        // Block ad-related API calls
                        if (url.includes('/pagead/') ||
                            url.includes('/api/stats/ads') ||
                            url.includes('/get_midroll_') ||
                            url.includes('doubleclick.net') ||
                            url.includes('&ad_type=') ||
                            url.includes('&oad=')) {
                            console.log('[Privacy Browser] Blocked ad fetch:', url.substring(0, 100));
                            return Promise.resolve(new Response('{}', { status: 200 }));
                        }
                    }
                    return originalFetch.apply(this, args);
                };
                
                // Intercept XHR for legacy ad requests
                const originalXHROpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                    if (typeof url === 'string') {
                        if (url.includes('/pagead/') ||
                            url.includes('/api/stats/ads') ||
                            url.includes('/get_midroll_') ||
                            url.includes('doubleclick.net')) {
                            console.log('[Privacy Browser] Blocked ad XHR:', url.substring(0, 100));
                            // Redirect to empty response
                            url = 'data:application/json,{}';
                        }
                    }
                    return originalXHROpen.call(this, method, url, ...rest);
                };
                
                // Block ad-related properties
                Object.defineProperty(window, 'ytInitialPlayerResponse', {
                    configurable: true,
                    set: function(value) {
                        if (value && typeof value === 'object') {
                            delete value.adPlacements;
                            delete value.playerAds;
                            delete value.adSlots;
                        }
                        Object.defineProperty(window, 'ytInitialPlayerResponse', {
                            value: value,
                            writable: true,
                            configurable: true
                        });
                    }
                });
            })();
        `;
        
        // Inject at document_start to intercept early
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }
    
    // ============================================
    // PART 4: Main Loop
    // ============================================
    
    function handleAds() {
        if (!isAdPlaying()) {
            skipAttempts = 0;
            return;
        }
        
        const now = Date.now();
        if (now - lastAdTime < config.skipDelay) return;
        lastAdTime = now;
        
        const adType = getAdType();
        log('Ad detected, type:', adType);
        
        switch (adType) {
            case 'skippable':
                if (clickSkipButton()) {
                    skipAttempts = 0;
                } else {
                    skipAttempts++;
                }
                break;
                
            case 'unskippable':
                if (skipAttempts < config.maxSkipAttempts) {
                    skipUnskippableAd();
                    skipAttempts++;
                }
                break;
                
            case 'overlay':
                removeOverlayAds();
                break;
                
            default:
                // Try all methods
                if (!clickSkipButton()) {
                    skipUnskippableAd();
                }
                removeOverlayAds();
        }
        
        closeAdInfoDialog();
    }
    
    // ============================================
    // PART 5: Mutation Observer for Dynamic Content
    // ============================================
    
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            for (const mutation of mutations) {
                // Check if ad-related elements were added
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.classList?.contains('ytp-ad-module') ||
                                node.classList?.contains('ad-showing') ||
                                node.querySelector?.('.ytp-ad-skip-button')) {
                                shouldCheck = true;
                                break;
                            }
                        }
                    }
                }
                
                // Check for class changes on player
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList?.contains('html5-video-player') ||
                        target.classList?.contains('ad-showing')) {
                        shouldCheck = true;
                    }
                }
            }
            
            if (shouldCheck) {
                setTimeout(handleAds, 50);
            }
        });
        
        // Observe the entire body for changes
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        
        return observer;
    }
    
    // ============================================
    // PART 6: CSS Injection for UI Cleanup
    // ============================================
    
    function injectAdBlockCSS() {
        const style = document.createElement('style');
        style.id = 'privacy-browser-yt-adblock';
        style.textContent = `
            /* Hide ad UI elements but preserve player controls */
            .ytp-ad-module,
            .ytp-ad-overlay-container,
            .ytp-ad-text-overlay,
            .ytp-ad-overlay-slot,
            .ytp-ad-player-overlay-instream-info,
            .ytp-ad-player-overlay-skip-or-preview,
            .ytp-ad-preview-container,
            .ytp-ad-survey,
            .ytp-ad-image-overlay,
            .ytp-ad-badge-text,
            ytd-ad-slot-renderer,
            ytd-banner-promo-renderer,
            ytd-in-feed-ad-layout-renderer,
            ytd-promoted-sparkles-web-renderer,
            ytd-display-ad-renderer,
            ytd-promoted-video-renderer,
            #masthead-ad,
            ytd-merch-shelf-renderer {
                display: none !important;
            }
            
            /* Make skip button more clickable if it exists */
            .ytp-ad-skip-button,
            .ytp-ad-skip-button-modern {
                opacity: 1 !important;
                pointer-events: auto !important;
            }
            
            /* Hide "Ad" badge on videos */
            .ytp-ad-badge,
            .ytp-ad-badge-text {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init() {
        log('YouTube Ad Blocker initializing...');
        
        // Inject interceptor as early as possible
        injectAdInterceptor();
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                injectAdBlockCSS();
                setupObserver();
                interceptPlayerAds();
            });
        } else {
            injectAdBlockCSS();
            setupObserver();
            interceptPlayerAds();
        }
        
        // Regular interval check as backup
        setInterval(handleAds, config.checkInterval);
        
        // Also check on navigation (for SPA)
        window.addEventListener('yt-navigate-finish', () => {
            log('YouTube navigation detected');
            setTimeout(interceptPlayerAds, 100);
            setTimeout(handleAds, 200);
        });
        
        log('YouTube Ad Blocker initialized');
    }
    
    init();
})();
