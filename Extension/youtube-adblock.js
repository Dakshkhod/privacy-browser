/**
 * Privacy Browser - YouTube Ad Blocking Module (Optimized)
 * 
 * PROACTIVE blocking - removes ad data BEFORE player loads
 * Videos should play instantly without waiting for ads
 */

(function() {
    'use strict';
    
    // Only run on YouTube
    if (!window.location.hostname.includes('youtube.com')) return;
    
    console.log('[Privacy Browser] YouTube Ad Blocker - Proactive Mode');
    
    // ============================================
    // PART 1: PROACTIVE - Remove ads from player config BEFORE it loads
    // This is the key to instant video playback
    // ============================================
    
    // Inject this script into the page context immediately
    const proactiveScript = document.createElement('script');
    proactiveScript.textContent = `
    (function() {
        'use strict';
        
        // Function to strip ad data from any object
        function stripAds(obj) {
            if (!obj || typeof obj !== 'object') return obj;
            
            const adKeys = [
                'adPlacements', 'adSlots', 'playerAds', 'adBreakParams',
                'adModule', 'advertisingId', 'adSignalsInfo', 'adSafetyReason',
                'adRequestConfig', 'adBreakHeartbeatParams', 'adParams',
                'instreamAdPlayerOverlayRenderer', 'adPlacementConfig'
            ];
            
            adKeys.forEach(key => {
                if (obj[key] !== undefined) {
                    delete obj[key];
                }
            });
            
            // Recursively clean nested objects
            if (obj.playerResponse) stripAds(obj.playerResponse);
            if (obj.player) stripAds(obj.player);
            if (obj.playerConfig) stripAds(obj.playerConfig);
            
            return obj;
        }
        
        // Override Object.defineProperty to intercept YouTube's data
        const originalDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj, prop, descriptor) {
            if (prop === 'ytInitialPlayerResponse' || 
                prop === 'ytInitialData' ||
                prop === 'playerResponse') {
                if (descriptor && descriptor.value) {
                    descriptor.value = stripAds(descriptor.value);
                }
            }
            return originalDefineProperty.call(this, obj, prop, descriptor);
        };
        
        // Intercept property assignments
        const handler = {
            set: function(target, prop, value) {
                if (prop === 'ytInitialPlayerResponse' || 
                    prop === 'ytInitialData' ||
                    prop === 'playerResponse') {
                    value = stripAds(value);
                }
                target[prop] = value;
                return true;
            }
        };
        
        // Intercept fetch responses
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const url = args[0]?.url || args[0] || '';
            
            // Block ad-related endpoints entirely (return empty fast)
            if (typeof url === 'string') {
                if (url.includes('/pagead/') ||
                    url.includes('/api/stats/ads') ||
                    url.includes('/api/stats/watchtime') && url.includes('adformat') ||
                    url.includes('/get_midroll_') ||
                    url.includes('/ptracking') ||
                    url.includes('/youtubei/v1/player/ad') ||
                    url.includes('doubleclick.net') ||
                    url.includes('googlesyndication.com')) {
                    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
            }
            
            const response = await originalFetch.apply(this, args);
            
            // Intercept player API responses to strip ads
            if (typeof url === 'string' && url.includes('/youtubei/v1/player')) {
                try {
                    const clone = response.clone();
                    const data = await clone.json();
                    stripAds(data);
                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        headers: response.headers
                    });
                } catch (e) {}
            }
            
            return response;
        };
        
        // Intercept XHR
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._url = url;
            return originalXHROpen.call(this, method, url, ...rest);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            if (this._url) {
                // Block ad requests immediately
                if (this._url.includes('/pagead/') ||
                    this._url.includes('/api/stats/ads') ||
                    this._url.includes('/get_midroll_') ||
                    this._url.includes('doubleclick.net')) {
                    // Fake successful empty response
                    Object.defineProperty(this, 'readyState', { value: 4 });
                    Object.defineProperty(this, 'status', { value: 200 });
                    Object.defineProperty(this, 'responseText', { value: '{}' });
                    this.dispatchEvent(new Event('load'));
                    return;
                }
            }
            return originalXHRSend.call(this, body);
        };
        
        // Clean existing data if already set
        if (window.ytInitialPlayerResponse) {
            window.ytInitialPlayerResponse = stripAds(window.ytInitialPlayerResponse);
        }
        if (window.ytInitialData) {
            window.ytInitialData = stripAds(window.ytInitialData);
        }
        
        // Monitor for player config and clean it
        let cleaned = false;
        const cleanPlayerConfig = () => {
            if (cleaned) return;
            
            // Clean ytInitialPlayerResponse
            if (window.ytInitialPlayerResponse) {
                stripAds(window.ytInitialPlayerResponse);
                cleaned = true;
            }
            
            // Clean yt.config_
            if (window.yt?.config_?.PLAYER_VARS) {
                stripAds(window.yt.config_.PLAYER_VARS);
            }
            
            // Clean ytplayer.config
            if (window.ytplayer?.config) {
                stripAds(window.ytplayer.config);
            }
        };
        
        // Run cleanup immediately and on DOM ready
        cleanPlayerConfig();
        document.addEventListener('DOMContentLoaded', cleanPlayerConfig);
        
        // Also intercept when scripts try to read these
        const watchProps = ['ytInitialPlayerResponse', 'ytInitialData'];
        watchProps.forEach(prop => {
            let value = window[prop];
            Object.defineProperty(window, prop, {
                get: () => stripAds(value),
                set: (v) => { value = stripAds(v); },
                configurable: true
            });
        });
        
        console.log('[Privacy Browser] Proactive ad blocking initialized');
    })();
    `;
    
    // Inject as early as possible
    (document.head || document.documentElement).prepend(proactiveScript);
    
    // ============================================
    // PART 2: CSS to hide any ad UI that slips through
    // ============================================
    
    const style = document.createElement('style');
    style.id = 'privacy-browser-yt-css';
    style.textContent = `
        /* Video player ad elements */
        .ytp-ad-module,
        .ytp-ad-overlay-container,
        .ytp-ad-text-overlay,
        .ytp-ad-overlay-slot,
        .ytp-ad-player-overlay,
        .ytp-ad-player-overlay-instream-info,
        .ytp-ad-player-overlay-skip-or-preview,
        .ytp-ad-preview-container,
        .video-ads,
        #player-ads,
        .ytp-ad-image-overlay,
        
        /* Feed ads */
        ytd-ad-slot-renderer,
        ytd-banner-promo-renderer,
        ytd-in-feed-ad-layout-renderer,
        ytd-promoted-sparkles-web-renderer,
        ytd-display-ad-renderer,
        ytd-promoted-video-renderer,
        ytd-compact-promoted-video-renderer,
        ytd-video-masthead-ad-v3-renderer,
        ytd-primetime-promo-renderer,
        ytd-statement-banner-renderer,
        ytd-search-pyv-renderer,
        ytd-merch-shelf-renderer,
        #masthead-ad,
        
        /* Rich item ads */
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
        ytd-rich-section-renderer:has(ytd-ad-slot-renderer) {
            display: none !important;
        }
        
        /* Make sure video plays immediately */
        .html5-video-player:not(.ad-showing) video {
            visibility: visible !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
    
    // ============================================
    // PART 3: Backup - Skip any ads that slip through
    // ============================================
    
    function skipAd() {
        const player = document.querySelector('.html5-video-player');
        if (!player?.classList.contains('ad-showing')) return;
        
        // Try skip button
        const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
        if (skipBtn) {
            skipBtn.click();
            return;
        }
        
        // Force skip by seeking
        const video = document.querySelector('video');
        if (video && video.duration && video.duration < 300) {
            video.currentTime = video.duration;
        }
    }
    
    // Check periodically but less frequently since proactive should work
    setInterval(skipAd, 1000);
    
    // Also watch for ad-showing class
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.target.classList?.contains('ad-showing')) {
                setTimeout(skipAd, 100);
            }
        }
    });
    
    if (document.body) {
        observer.observe(document.body, { 
            subtree: true, 
            attributes: true, 
            attributeFilter: ['class'] 
        });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { 
                subtree: true, 
                attributes: true, 
                attributeFilter: ['class'] 
            });
        });
    }
    
    console.log('[Privacy Browser] YouTube Ad Blocker active');
})();
