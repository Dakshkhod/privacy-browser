/**
 * Poliscope - YouTube Ad Blocking (Safe Mode).
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
    // 2. Ad-skip loop — polls while `ad-showing` is on the player.
    //
    // The OLD design used a one-shot batch of 6 attempts then waited for the
    // MutationObserver to refire. For back-to-back ads, the player can keep
    // `ad-showing` set continuously across both ads (no class change between
    // them), so ad 2 was never re-detected.
    //
    // NEW design: while `ad-showing` is set, a 500ms poll runs that does BOTH
    //   1. Click the skip button if it's visible (works for skippable ads)
    //   2. Fast-forward the ad <video> to its end (works for UNSKIPPABLE ads
    //      and for back-to-back transitions — once ad 1 ends, ad 2 attaches
    //      to the same <video> element and gets the same treatment)
    // The poll stops the instant `ad-showing` is gone, so the real content
    // video is never touched.
    // ------------------------------------------------------------------
    const SKIP_SELECTORS = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        'button.ytp-ad-skip-button-modern',
        '.ytp-ad-skip-button-container button'
    ];

    function tryClickSkip(player) {
        for (const sel of SKIP_SELECTORS) {
            const btn = player.querySelector(sel) || document.querySelector(sel);
            if (btn && btn.offsetParent !== null && !btn.disabled) {
                btn.click();
                return true;
            }
        }
        return false;
    }

    function fastForwardAd(player) {
        const video = player.querySelector('video');
        if (!video) return false;
        const dur = video.duration;
        if (!dur || !isFinite(dur) || dur < 1) return false;
        // Only seek if we're not already near the end (avoid loops).
        if (video.currentTime < dur - 0.3) {
            try {
                video.muted = true;
                video.currentTime = dur - 0.1;
                return true;
            } catch (_) {
                return false;
            }
        }
        return false;
    }

    let pollTimer = null;
    function startAdPoll() {
        if (pollTimer) return;
        const tick = () => {
            const player = document.querySelector('.html5-video-player');
            if (!player || !player.classList.contains('ad-showing')) {
                clearInterval(pollTimer);
                pollTimer = null;
                return;
            }
            // Try both: skip button click AND fast-forward.
            // Order matters — skip first (clean), seek second (fallback).
            if (!tryClickSkip(player)) {
                fastForwardAd(player);
            }
        };
        // Run once immediately so the first ad's transition is caught fast.
        tick();
        if (pollTimer) return; // tick may have already cleared if ad-showing dropped
        pollTimer = setInterval(tick, 500);
    }

    const playerObserver = new MutationObserver(() => {
        const player = document.querySelector('.html5-video-player');
        if (player && player.classList.contains('ad-showing')) {
            startAdPoll();
        }
    });

    function startObserver() {
        const player = document.querySelector('.html5-video-player');
        if (player) {
            playerObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
            // Initial check in case ad already showing
            if (player.classList.contains('ad-showing')) startAdPoll();
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
