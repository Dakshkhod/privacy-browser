/**
 * Privacy Browser - Data Type Blocker (isolated-world surface only).
 *
 * Page-context overrides (navigator/canvas/WebGL/AudioContext fingerprint
 * spoofing) now live in page-inject.js (runs in MAIN world). This module
 * applies only safe, isolated-world DOM-level changes (CSS hides, autofill
 * markers, warning overlays) based on user preferences.
 */
(function () {
    'use strict';

    let blockingPrefs = {
        location: false,
        device: false,
        usage: false,
        contact: false,
        financial: false,
        biometric: false,
        health: false,
        social: false,
        behavioral: false
    };

    function applyAll() {
        if (blockingPrefs.contact) markAutofillContact();
        if (blockingPrefs.financial) markFinancialFields();
        if (blockingPrefs.health) markHealthFields();
        if (blockingPrefs.social) injectSocialBlockCSS();
    }

    if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
            chrome.storage.local.get(['dataBlocking'], (result) => {
                if (result && result.dataBlocking) {
                    blockingPrefs = { ...blockingPrefs, ...result.dataBlocking };
                    applyOnReady();
                }
            });
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace !== 'local' || !changes.dataBlocking) return;
                blockingPrefs = { ...blockingPrefs, ...(changes.dataBlocking.newValue || {}) };
                applyOnReady();
            });
        } catch (_) {}
    }

    function applyOnReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyAll, { once: true });
        } else {
            applyAll();
        }
    }

    // ------------------------------------------------------------------
    // Contact info: disable autofill on email/phone/etc. inputs.
    // ------------------------------------------------------------------
    function markAutofillContact() {
        const contactFields = ['email', 'tel', 'phone', 'address', 'name', 'postal'];
        function run() {
            contactFields.forEach(field => {
                try {
                    document.querySelectorAll(
                        `input[type="${field}"], input[name*="${field}" i], input[autocomplete*="${field}" i]`
                    ).forEach(input => {
                        input.setAttribute('autocomplete', 'off');
                        input.setAttribute('data-privacy-blocked', 'contact');
                    });
                } catch (_) {}
            });
        }
        run();
        try {
            const observer = new MutationObserver(run);
            if (document.body) observer.observe(document.body, { childList: true, subtree: true });
        } catch (_) {}
    }

    // ------------------------------------------------------------------
    // Financial fields: visual warning + autocomplete=off.
    // ------------------------------------------------------------------
    function markFinancialFields() {
        const financialFields = ['card', 'credit', 'cvv', 'cvc', 'expir', 'payment', 'bank', 'account'];
        function run() {
            financialFields.forEach(field => {
                try {
                    document.querySelectorAll(
                        `input[name*="${field}" i], input[id*="${field}" i], input[placeholder*="${field}" i]`
                    ).forEach(input => {
                        if (input.dataset.privacyWarned) return;
                        input.dataset.privacyWarned = 'true';
                        input.style.outline = '2px solid #ff9800';
                        input.title = 'Privacy Browser: Financial data field';
                    });
                } catch (_) {}
            });
        }
        run();
        try {
            const observer = new MutationObserver(run);
            if (document.body) observer.observe(document.body, { childList: true, subtree: true });
        } catch (_) {}
    }

    // ------------------------------------------------------------------
    // Health fields: red outline + tooltip.
    // ------------------------------------------------------------------
    function markHealthFields() {
        const healthFields = ['health', 'medical', 'diagnosis', 'prescription', 'doctor', 'patient', 'symptom', 'condition', 'medication'];
        function run() {
            healthFields.forEach(field => {
                try {
                    document.querySelectorAll(
                        `input[name*="${field}" i], textarea[name*="${field}" i], select[name*="${field}" i]`
                    ).forEach(el => {
                        if (el.dataset.privacyWarned) return;
                        el.dataset.privacyWarned = 'true';
                        el.style.outline = '2px solid #f44336';
                        el.title = 'Privacy Browser: Health data field - be cautious';
                    });
                } catch (_) {}
            });
        }
        run();
        try {
            const observer = new MutationObserver(run);
            if (document.body) observer.observe(document.body, { childList: true, subtree: true });
        } catch (_) {}
    }

    // ------------------------------------------------------------------
    // Social: CSS to mute social login / sharing widgets.
    // ------------------------------------------------------------------
    function injectSocialBlockCSS() {
        if (document.getElementById('privacy-browser-social-block')) return;
        const style = document.createElement('style');
        style.id = 'privacy-browser-social-block';
        style.textContent = `
            [class*="facebook-login"], [class*="google-login"],
            [class*="twitter-login"], [class*="social-login"],
            [class*="oauth"],
            [id*="facebook-login"], [id*="google-login"],
            [data-provider="facebook"], [data-provider="google"], [data-provider="twitter"],
            .fb-share-button, .twitter-share-button, .fb-like,
            [class*="social-share"], [class*="share-button"],
            .addthis_toolbox, .shareaholic-share-buttons {
                opacity: 0.3 !important;
                pointer-events: none !important;
                position: relative !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // Expose for debugging
    try { window.__privacyBrowserBlocking = blockingPrefs; } catch (_) {}
})();
