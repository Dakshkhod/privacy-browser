/**
 * Privacy Browser - YouTube Ad Blocking (Safe Mode)
 * 
 * Simple, safe approach that won't break video playback:
 * 1. CSS to hide ad elements
 * 2. Auto-click skip button only
 * 3. NO video manipulation (was causing the 20s skip bug)
 */

(function() {
    'use strict';
    
    if (!window.location.hostname.includes('youtube.com')) return;
    
    console.log('[Privacy Browser] YouTube - Safe ad blocking active');
    
    // ============================================
    // 1. CSS - Hide ad elements (safe, no side effects)
    // ============================================
    
    const style = document.createElement('style');
    style.id = 'privacy-browser-yt';
    style.textContent = `
        /* Feed/Homepage ads */
        ytd-ad-slot-renderer,
        ytd-banner-promo-renderer,
        ytd-in-feed-ad-layout-renderer,
        ytd-promoted-sparkles-web-renderer,
        ytd-display-ad-renderer,
        ytd-promoted-video-renderer,
        ytd-compact-promoted-video-renderer,
        ytd-search-pyv-renderer,
        ytd-merch-shelf-renderer,
        ytd-statement-banner-renderer,
        #masthead-ad,
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
        
        /* Overlay ads on video */
        .ytp-ad-overlay-container,
        .ytp-ad-text-overlay,
        .ytp-ad-overlay-slot,
        .ytp-ad-overlay-image {
            display: none !important;
        }
    `;
    
    // Inject CSS early
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.head.appendChild(style);
        });
    }
    
    // ============================================
    // 2. Auto-click skip button ONLY (safe)
    // ============================================
    
    function clickSkipButton() {
        // Only click if there's actually an ad playing
        const player = document.querySelector('.html5-video-player');
        if (!player || !player.classList.contains('ad-showing')) {
            return false;
        }
        
        const skipSelectors = [
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern', 
            '.ytp-skip-ad-button',
            'button.ytp-ad-skip-button-modern'
        ];
        
        for (const selector of skipSelectors) {
            const btn = document.querySelector(selector);
            if (btn && btn.offsetParent !== null) {
                btn.click();
                console.log('[Privacy Browser] Clicked skip button');
                return true;
            }
        }
        return false;
    }
    
    // Check for skip button periodically
    setInterval(clickSkipButton, 500);
    
    // ============================================
    // 3. Watch for ad-showing class (to click skip faster)
    // ============================================
    
    const observer = new MutationObserver(() => {
        const player = document.querySelector('.html5-video-player');
        if (player?.classList.contains('ad-showing')) {
            // Small delay to let skip button appear
            setTimeout(clickSkipButton, 100);
            setTimeout(clickSkipButton, 500);
            setTimeout(clickSkipButton, 1000);
            setTimeout(clickSkipButton, 3000);
            setTimeout(clickSkipButton, 5000);
        }
    });
    
    // Start observing when DOM is ready
    function startObserver() {
        const player = document.querySelector('.html5-video-player');
        if (player) {
            observer.observe(player, { attributes: true, attributeFilter: ['class'] });
        } else {
            // Retry if player not found yet
            setTimeout(startObserver, 1000);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
    
})();
