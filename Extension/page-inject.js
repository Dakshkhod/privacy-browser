/**
 * Poliscope - Page-context fingerprinting blocker.
 *
 * Runs in the page's MAIN world (NOT the isolated content-script world) so that
 * navigator/canvas/webgl overrides actually affect the page's scripts.
 * Reads the active blocking prefs from a data-* attribute on the <script> tag.
 */
(function () {
    'use strict';
    try {
        const me = document.currentScript;
        let prefs = {};
        if (me && me.dataset && me.dataset.prefs) {
            try { prefs = JSON.parse(me.dataset.prefs) || {}; } catch (_) { prefs = {}; }
        }

        // --- Device info spoofing (only safe properties; no eval/getComputedStyle overrides) ---
        if (prefs.device) {
            const def = (obj, key, val) => {
                try { Object.defineProperty(obj, key, { get: () => val, configurable: true }); } catch (_) {}
            };
            def(navigator, 'hardwareConcurrency', 4);
            def(navigator, 'deviceMemory', 8);
            // intentionally do NOT spoof platform/vendor/language: breaks localized sites.
            if (navigator.getBattery) {
                try {
                    navigator.getBattery = () => Promise.reject(new Error('Blocked by Poliscope'));
                } catch (_) {}
            }
        }

        // --- Behavioral / fingerprinting blocking ---
        if (prefs.behavioral) {
            // Canvas fingerprinting: add deterministic per-origin noise (per-pixel ^1 LSB)
            try {
                const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
                const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
                CanvasRenderingContext2D.prototype.getImageData = function () {
                    const data = origGetImageData.apply(this, arguments);
                    try {
                        for (let i = 0; i < data.data.length; i += 4) {
                            data.data[i] = data.data[i] ^ 1;
                        }
                    } catch (_) {}
                    return data;
                };
                HTMLCanvasElement.prototype.toDataURL = function () {
                    return origToDataURL.apply(this, arguments);
                };
            } catch (_) {}

            // WebGL renderer/vendor spoof
            try {
                const origGetParam = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function (param) {
                    if (param === 37445) return 'Intel Inc.';
                    if (param === 37446) return 'Intel Iris OpenGL Engine';
                    return origGetParam.call(this, param);
                };
                if (window.WebGL2RenderingContext) {
                    const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
                    WebGL2RenderingContext.prototype.getParameter = function (param) {
                        if (param === 37445) return 'Intel Inc.';
                        if (param === 37446) return 'Intel Iris OpenGL Engine';
                        return origGetParam2.call(this, param);
                    };
                }
            } catch (_) {}
        }

        // --- Anti-adblock bypass (opt-in per-origin via prefs.antiAdblock) ---
        if (prefs.antiAdblock) {
            try {
                const fakeAd = document.createElement('div');
                fakeAd.className = 'adsbox ad-placeholder pub_300x250';
                fakeAd.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
                fakeAd.innerHTML = '&nbsp;';
                (document.documentElement || document.body || document.head).appendChild(fakeAd);
            } catch (_) {}

            const flagProps = [
                'canRunAds', 'showAds', 'adsEnabled', 'noAdBlock'
            ];
            flagProps.forEach((p) => {
                try {
                    Object.defineProperty(window, p, { get: () => true, configurable: true });
                } catch (_) {}
            });
        }

        // Remove the injected script tag itself to keep DOM clean.
        if (me && me.parentNode) me.parentNode.removeChild(me);
    } catch (_) {
        // swallow — never break the host page
    }
})();
