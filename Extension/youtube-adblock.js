/**
 * Privacy Browser - YouTube Ad Blocking (Safe Mode).
 *
 * Strategy:
 *   1. CSS hides feed/overlay ads (deterministic, no JS side-effects).
 *   2. Skip button is clicked ONLY when the player's class changes to
 *      `ad-showing` — driven by a MutationObserver instead of a forever
 *      setInterval. No CPU drain on idle tabs.
 */
(function () {
    'use strict';
    if (!window.location.hostname.includes('youtube.com')) return;

    // ------------------------------------------------------------------
    // 1. CSS — hide ad elements.
    // ------------------------------------------------------------------
    function injectCSS() {
        if (document.getElementById('privacy-browser-yt')) return;
        const style = document.createElement('style');
        style.id = 'privacy-browser-yt';
        style.textContent = `
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
            .ytp-ad-overlay-container,
            .ytp-ad-text-overlay,
            .ytp-ad-overlay-slot,
            .ytp-ad-overlay-image {
                display: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }
    if (document.head) injectCSS();
    else document.addEventListener('DOMContentLoaded', injectCSS, { once: true });

    // ------------------------------------------------------------------
    // 2. Skip-button autoclicker — observer-driven.
    // ------------------------------------------------------------------
    const SKIP_SELECTORS = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        'button.ytp-ad-skip-button-modern'
    ];

    function tryClickSkip() {
        const player = document.querySelector('.html5-video-player');
        if (!player || !player.classList.contains('ad-showing')) return false;
        for (const sel of SKIP_SELECTORS) {
            const btn = document.querySelector(sel);
            if (btn && btn.offsetParent !== null) {
                btn.click();
                return true;
            }
        }
        return false;
    }

    let pendingTimer = null;
    function scheduleSkipAttempts() {
        if (pendingTimer) return; // one batch at a time
        let attempt = 0;
        const tick = () => {
            attempt++;
            if (tryClickSkip()) {
                pendingTimer = null;
                return;
            }
            if (attempt < 6) {
                pendingTimer = setTimeout(tick, 800);
            } else {
                pendingTimer = null;
            }
        };
        pendingTimer = setTimeout(tick, 100);
    }

    const playerObserver = new MutationObserver(() => {
        const player = document.querySelector('.html5-video-player');
        if (player && player.classList.contains('ad-showing')) {
            scheduleSkipAttempts();
        }
    });

    function startObserver() {
        const player = document.querySelector('.html5-video-player');
        if (player) {
            playerObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
            // Initial check in case ad already showing
            if (player.classList.contains('ad-showing')) scheduleSkipAttempts();
        } else {
            // Player may not exist yet on initial navigation
            setTimeout(startObserver, 1500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver, { once: true });
    } else {
        startObserver();
    }
})();
