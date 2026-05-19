// Poliscope - Content Script
// Features: Ad hiding (CSS-first), Cookie consent auto-reject (scoped),
//           Form field scanner, Script analyzer, opt-in restriction remover.
// All page-context overrides (canvas/webgl/anti-adblock) are delegated to
// page-inject.js running in MAIN world — see manifest web_accessible_resources.

(function () {
    'use strict';

    // ============================================
    // WHITELIST - Skip these domains entirely
    // ============================================
    const whitelistedDomains = [
        // Google services that depend on Google JS / CSP
        'google.com', 'google.co.in', 'google.co.uk',
        'googleapis.com', 'gstatic.com',
        'gemini.google.com', 'bard.google.com',
        'mail.google.com', 'drive.google.com', 'docs.google.com',
        'sheets.google.com', 'slides.google.com', 'meet.google.com',
        'calendar.google.com', 'photos.google.com',
        'accounts.google.com', 'myaccount.google.com',
        'classroom.google.com', 'chat.google.com', 'messages.google.com',
        // AI services
        'openai.com', 'chat.openai.com', 'chatgpt.com',
        'claude.ai', 'anthropic.com', 'perplexity.ai',
        'copilot.microsoft.com', 'bing.com',
        // Banking/Finance
        'paypal.com', 'stripe.com', 'razorpay.com', 'paytm.com',
        'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citi.com',
        'coinbase.com', 'kraken.com',
        // Developer
        'github.com', 'gitlab.com', 'stackoverflow.com',
        // Streaming (kept core-functional)
        'netflix.com', 'primevideo.com', 'hotstar.com',
        'disneyplus.com', 'spotify.com',
        // Social with core JS-driven UI
        'twitter.com', 'x.com', 'linkedin.com',
        'discord.com', 'slack.com', 'telegram.org',
        'web.telegram.org', 'web.whatsapp.com'
    ];

    function isWhitelistedDomain() {
        const hostname = (window.location.hostname || '').toLowerCase();
        return whitelistedDomains.some(domain =>
            hostname === domain || hostname.endsWith('.' + domain)
        );
    }

    if (isWhitelistedDomain()) return;

    const isYouTube = window.location.hostname.includes('youtube.com') ||
                      window.location.hostname.includes('youtu.be');
    if (isYouTube) return; // handled by youtube-adblock.js

    // ============================================
    // Settings & page-context injection
    // ============================================
    let settings = {
        autoRejectCookies: true,
        scanForms: true,
        blockAds: true,
        bypassPaywalls: false,    // opt-in
        antiAdblock: false        // opt-in per-origin
    };
    let dataBlocking = {};

    function loadSettings(cb) {
        try {
            chrome.storage.local.get(['privacySettings', 'dataBlocking', 'antiAdblockOrigins']).then(result => {
                if (result.privacySettings) settings = { ...settings, ...result.privacySettings };
                if (result.dataBlocking) dataBlocking = result.dataBlocking;
                const origins = result.antiAdblockOrigins || {};
                settings.antiAdblock = !!origins[window.location.hostname];
                cb && cb();
            }).catch(() => cb && cb());
        } catch (_) {
            cb && cb();
        }
    }

    // Inject page-context script (MAIN world) to apply opt-in fingerprint
    // overrides. Uses chrome.runtime.getURL so it loads from a web-accessible
    // extension resource (declared in manifest).
    function injectPageContext() {
        try {
            const prefs = {
                device: !!dataBlocking.device,
                behavioral: !!dataBlocking.behavioral,
                antiAdblock: !!settings.antiAdblock
            };
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('page-inject.js');
            script.dataset.prefs = JSON.stringify(prefs);
            script.async = false;
            (document.documentElement || document.head).appendChild(script);
        } catch (_) {}
    }

    // ============================================
    // FEATURE 1: Cookie Consent Auto-Rejector (scoped to banners only)
    // ============================================
    const cookieSelectors = {
        banners: [
            '[class*="cookie-banner"]', '[class*="cookie-consent"]', '[class*="cookie-notice"]',
            '[class*="cookie-popup"]', '[class*="cookieBanner"]',
            '[class*="consent-banner"]', '[class*="consent-popup"]',
            '[class*="gdpr-banner"]', '[class*="gdpr-consent"]',
            '[id*="cookie-banner"]', '[id*="cookie-consent"]', '[id*="cookieConsent"]',
            '[id*="gdpr"]', '[class*="cc-banner"]', '[class*="cc-window"]',
            '#onetrust-banner-sdk', '#CybotCookiebotDialog', '.osano-cm-window',
            '[class*="truste"]', '[class*="evidon"]',
            '[aria-label*="cookie" i]', '[aria-label*="consent" i]',
            '.qc-cmp2-container', '#qc-cmp2-ui'
        ],
        rejectButtons: [
            'button[class*="reject"]', 'button[class*="decline"]',
            'button[class*="deny"]', 'button[class*="refuse"]',
            'a[class*="reject"]', 'a[class*="decline"]',
            '[class*="reject-all"]', '[class*="decline-all"]', '[class*="deny-all"]',
            '#onetrust-reject-all-handler', '.cc-deny',
            '[data-action="reject"]', '[data-consent="reject"]',
            'button[title*="Reject" i]', 'button[title*="Decline" i]'
        ],
        essentialButtons: [
            '[class*="necessary-only"]', '[class*="essential-only"]', '[class*="required-only"]',
            'button[class*="necessary"]', '[id*="necessary"]'
        ]
    };

    const rejectTextPatterns = [
        'reject all', 'reject', 'decline all', 'decline', 'deny all', 'deny',
        'refuse all', 'refuse', 'no thanks', 'no, thanks', 'only necessary',
        'necessary only', 'essential only', 'nur notwendige', 'ablehnen',
        'refuser', 'rechazar', 'rifiuta'
    ];
    const acceptTextPatterns = [
        'accept all', 'accept', 'agree', 'allow all', 'allow', 'got it',
        'i understand', 'ok', 'okay', 'continue', 'yes'
    ];

    function isVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            el.offsetParent !== null;
    }

    function findBannerContainer(el) {
        for (const sel of cookieSelectors.banners) {
            try {
                if (el.closest(sel)) return el.closest(sel);
            } catch (_) {}
        }
        return null;
    }

    function getActiveBanners() {
        const out = [];
        for (const sel of cookieSelectors.banners) {
            try {
                document.querySelectorAll(sel).forEach(b => {
                    if (isVisible(b) && !out.includes(b)) out.push(b);
                });
            } catch (_) {}
        }
        return out;
    }

    function handleCookieConsent() {
        if (!settings.autoRejectCookies) return;
        const banners = getActiveBanners();
        if (banners.length === 0) return;

        for (const banner of banners) {
            // Specific reject selectors inside banner
            for (const selector of cookieSelectors.rejectButtons) {
                let btn = null;
                try { btn = banner.querySelector(selector); } catch (_) {}
                if (btn && isVisible(btn)) {
                    btn.click();
                    notifyBackgroundCookieRejected();
                    return;
                }
            }
            // Essential-only
            for (const selector of cookieSelectors.essentialButtons) {
                let btn = null;
                try { btn = banner.querySelector(selector); } catch (_) {}
                if (btn && isVisible(btn)) {
                    btn.click();
                    notifyBackgroundCookieRejected();
                    return;
                }
            }
            // Text-based match scoped to in-banner buttons
            const buttons = banner.querySelectorAll('button, a[role="button"], [class*="btn"]');
            for (const btn of buttons) {
                const text = (btn.textContent || '').toLowerCase().trim();
                if (!text) continue;
                if (acceptTextPatterns.some(p => text === p || text.startsWith(p))) continue;
                if (rejectTextPatterns.some(p => text === p || text.includes(p))) {
                    if (isVisible(btn)) {
                        btn.click();
                        notifyBackgroundCookieRejected();
                        return;
                    }
                }
            }
        }
    }

    function notifyBackgroundCookieRejected() {
        try {
            chrome.runtime.sendMessage({
                type: 'COOKIE_REJECTED',
                domain: window.location.hostname
            }).catch(() => {});
        } catch (_) {}
    }

    // ============================================
    // FEATURE 2: Form Field Privacy Scanner
    // ============================================
    const sensitiveFieldPatterns = {
        ssn: { patterns: ['ssn', 'social-security', 'socialsecurity', 'social_security'], label: 'SSN', risk: 'critical', icon: '🔴' },
        creditCard: { patterns: ['card-number', 'cardnumber', 'cc-number', 'ccnumber', 'credit-card', 'creditcard', 'payment-card'], label: 'Credit Card', risk: 'critical', icon: '🔴' },
        cvv: { patterns: ['cvv', 'cvc', 'security-code', 'securitycode', 'card-code'], label: 'CVV', risk: 'critical', icon: '🔴' },
        passport: { patterns: ['passport', 'passport-number'], label: 'Passport', risk: 'high', icon: '🟠' },
        dob: { patterns: ['dob', 'date-of-birth', 'dateofbirth', 'birth-date', 'birthdate'], label: 'Date of Birth', risk: 'medium', icon: '🟡' },
        phone: { patterns: ['phone', 'mobile', 'tel', 'cell'], label: 'Phone', risk: 'low', icon: '🟢' },
        address: { patterns: ['address', 'street', 'city', 'zip', 'postal'], label: 'Address', risk: 'low', icon: '🟢' }
    };

    function getLabelText(input) {
        if (input.id) {
            try {
                const label = document.querySelector('label[for="' + CSS.escape(input.id) + '"]');
                if (label) return label.textContent || '';
            } catch (_) {}
        }
        const parentLabel = input.closest && input.closest('label');
        if (parentLabel) return parentLabel.textContent || '';
        return '';
    }

    function getFieldInfo(input) {
        return {
            name: (input.name || '').toLowerCase(),
            id: (input.id || '').toLowerCase(),
            type: (input.type || '').toLowerCase(),
            placeholder: (input.placeholder || '').toLowerCase(),
            autocomplete: (input.autocomplete || '').toLowerCase(),
            ariaLabel: (input.getAttribute('aria-label') || '').toLowerCase(),
            label: getLabelText(input).toLowerCase()
        };
    }

    function detectSensitiveField(fieldInfo) {
        const allText = Object.values(fieldInfo).join(' ');
        for (const [type, config] of Object.entries(sensitiveFieldPatterns)) {
            for (const pattern of config.patterns) {
                if (allText.includes(pattern)) return type;
            }
        }
        if (fieldInfo.type === 'tel') return 'phone';
        if (fieldInfo.autocomplete.includes('cc-')) return 'creditCard';
        return null;
    }

    function addFieldWarning(input, fieldType, isSecure) {
        if (input.dataset.privacyScanned) return;
        if (!isVisible(input)) return; // skip honeypots / hidden inputs
        input.dataset.privacyScanned = 'true';

        const badge = document.createElement('div');
        badge.className = 'privacy-browser-field-warning';
        badge.textContent = fieldType.icon + ' ' + fieldType.label; // safe assignment
        badge.title = isSecure
            ? `This field collects ${fieldType.label} data`
            : `WARNING: ${fieldType.label} on insecure page!`;
        badge.style.cssText =
            'position:absolute;top:-20px;right:0;background:' +
            (isSecure ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)') +
            ';color:white;padding:2px 6px;border-radius:4px;font-size:10px;' +
            'font-family:-apple-system,BlinkMacSystemFont,sans-serif;z-index:10000;pointer-events:none;';

        const wrapper = input.parentElement;
        if (wrapper) {
            if (getComputedStyle(wrapper).position === 'static') {
                wrapper.style.position = 'relative';
            }
            wrapper.appendChild(badge);
        }

        if (!isSecure && (fieldType.risk === 'critical' || fieldType.risk === 'high')) {
            input.style.border = '2px solid #ef4444';
            input.style.boxShadow = '0 0 5px rgba(239, 68, 68, 0.5)';
        }
    }

    function scanFormFields() {
        if (!settings.scanForms) return;
        const inputs = document.querySelectorAll('input, textarea, select');
        const isSecure = window.location.protocol === 'https:';
        const sensitiveFields = [];

        inputs.forEach(input => {
            const info = getFieldInfo(input);
            const matched = detectSensitiveField(info);
            if (matched) {
                sensitiveFields.push({
                    type: matched,
                    label: sensitiveFieldPatterns[matched].label,
                    risk: sensitiveFieldPatterns[matched].risk,
                    isSecure
                });
                addFieldWarning(input, sensitiveFieldPatterns[matched], isSecure);
            }
        });

        if (sensitiveFields.length > 0) {
            try {
                chrome.runtime.sendMessage({
                    type: 'SENSITIVE_FIELDS_DETECTED',
                    domain: window.location.hostname,
                    isSecure,
                    fields: sensitiveFields
                }).catch(() => {});
            } catch (_) {}
        }
    }

    // ============================================
    // FEATURE 3: Third-Party Script Analyzer
    // ============================================
    function analyzeScripts() {
        const scripts = [];
        const currentDomain = window.location.hostname;
        document.querySelectorAll('script[src]').forEach(script => {
            try {
                const url = new URL(script.src, window.location.origin);
                const scriptDomain = url.hostname;
                if (!scriptDomain.includes(currentDomain) && !currentDomain.includes(scriptDomain)) {
                    scripts.push({
                        domain: scriptDomain,
                        url: script.src,
                        async: !!script.async,
                        defer: !!script.defer
                    });
                }
            } catch (_) {}
        });

        if (scripts.length > 0) {
            try {
                chrome.runtime.sendMessage({
                    type: 'SCRIPTS_ANALYZED',
                    domain: currentDomain,
                    scripts
                }).catch(() => {});
            } catch (_) {}
        }
    }

    // ============================================
    // FEATURE 4: Ad hiding (CSS-first, deterministic)
    // ============================================
    const hideCSS = `
        [class*="ad-container"], [class*="ad_container"], [class*="adContainer"],
        [class*="ad-wrapper"], [class*="ad_wrapper"], [class*="adWrapper"],
        [class*="ad-box"], [class*="ad_box"], [class*="adBox"],
        [class*="ad-unit"], [class*="ad_unit"], [class*="adUnit"],
        [class*="ad-slot"], [class*="ad_slot"], [class*="adSlot"],
        [class*="ad-banner"], [class*="ad_banner"], [class*="adBanner"],
        [class*="ad-block"], [class*="ad_block"], [class*="adBlock"],
        [class*="ad-frame"], [class*="ad_frame"], [class*="adFrame"],
        [class*="ad-placement"], [class*="ad_placement"], [class*="adPlacement"],
        [class*="ad-zone"], [class*="ad_zone"], [class*="adZone"],
        [id*="ad-container"], [id*="adContainer"], [id*="ad-wrapper"],
        [id*="ad-slot"], [id*="div-gpt-ad"], [id*="google_ads"], [id*="googleAds"],
        [data-ad], [data-ad-slot], [data-ad-unit], [data-ad-client],
        [data-ad-channel], [data-ad-format], [data-ad-layout],
        [data-adservice], [data-google-query-id], [data-freestar-ad],
        [data-taboola], [data-outbrain], [data-native-ad],
        .adsbygoogle, .google-ad, .gpt-ad, .dfp-ad,
        .taboola, .taboola-widget, .taboola-container, [class*="taboola"],
        .outbrain, .outbrain-widget, [class*="outbrain"],
        .mgid, .mgid-widget, [class*="mgid"],
        .revcontent, .criteo, .amazon-ad, .adsense,
        [class*="colombia"],
        iframe[src*="ads"], iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
        iframe[src*="taboola"], iframe[src*="outbrain"], iframe[src*="mgid"],
        iframe[src*="amazon-adsystem"], iframe[src*="aps.amazon"],
        iframe[id*="google_ads_iframe"],
        ins.adsbygoogle, amp-ad, amp-embed, amp-sticky-ad,
        [aria-label*="advertisement" i], [aria-label*="Sponsored" i],

        /* ---- Times of India ---- */
        .ad300x250, .ad728x90, .ad160x600, .ad970x90, .ad320x50,
        [id*="widget_dfp"], [id*="toi-ads"], [class*="toi-ad"],
        .sponsored-widget, .sponsored-article, [class*="toiSponsor"],
        [id*="div-gpt"], .dfp-ads, .dfp-ad-unit,
        [class*="InArticleAd"], [class*="in-article-ad"],
        .article-ad, .article_ad, [class*="articleAd"],

        /* ---- NDTV ---- */
        .advertisement, .Advertisement, [class*="advertisement"],
        .adv_top_div, .adv_btm_div, .adv_mid_div,
        [class*="ndtv-ad"], [class*="ndtvAd"],
        [class*="sponsor-"], [class*="sponsored"],
        .right-ad-div, .left-ad-div, .top-ad-div, .btm-ad-div,

        /* ---- Indian news sites (common patterns) ---- */
        [id*="AdDiv"], [id*="adDiv"], [class*="AdDiv"],
        [id*="RightAd"], [id*="LeftAd"], [id*="TopAd"], [id*="BotAd"],
        [class*="rightAd"], [class*="leftAd"], [class*="topAd"],
        .sticky-ad, .sticky_ad, [class*="stickyAd"],
        .float-ad, .float_ad, [class*="floatAd"],
        .sidebar-ad, .sidebar_ad, [class*="sidebarAd"],
        [class*="between-content-ad"], [class*="in-feed-ad"],
        [class*="native-ad"], [class*="nativeAd"], [class*="native_ad"],
        [id*="native-ad"], [id*="nativeAd"],
        [class*="promo-box"], [class*="promoBox"], [class*="promo_box"],
        [data-widget-type*="ad"], [data-type="advertisement"],
        [data-module*="ad"], [data-block*="ad"],

        /* ---- Sticky/overlay ads ---- */
        [class*="sticky-bottom"], [class*="bottom-sticky"],
        [class*="interstitial"], [id*="interstitial"],
        [class*="lightbox-ad"], [class*="overlay-ad"],
        [class*="popup-ad"], [class*="popupAd"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
        }
    `;

    function injectHideCSS() {
        if (!settings.blockAds) return;
        const style = document.createElement('style');
        style.id = 'privacy-browser-hide-ads';
        style.textContent = hideCSS;
        (document.head || document.documentElement).appendChild(style);
    }

    // ============================================
    // FEATURE 5: Restriction remover (paywall bypass) - opt-in only
    // ============================================
    function removeContentRestrictions() {
        if (!settings.blockAds || !settings.bypassPaywalls) return;
        const restrictionCSS = `
            html, body {
                overflow: auto !important;
                overflow-y: auto !important;
            }
            [class*="paywall"]:not([class*="button"]),
            [class*="premium-lock"] {
                filter: none !important;
                -webkit-filter: none !important;
            }
            [class*="truncate"], [class*="fade-out"], [class*="content-fade"] {
                max-height: none !important;
                height: auto !important;
                overflow: visible !important;
                -webkit-mask-image: none !important;
                mask-image: none !important;
            }
            [class*="adblock-modal"], [class*="adblock-overlay"],
            [class*="paywall-overlay"], [class*="subscription-modal"],
            [class*="piano-modal"], [class*="regwall"],
            .fc-ab-root, .fc-dialog-container {
                display: none !important;
                visibility: hidden !important;
            }
        `;
        const style = document.createElement('style');
        style.id = 'privacy-browser-restriction-remover';
        style.textContent = restrictionCSS;
        (document.head || document.documentElement).appendChild(style);
    }

    // ============================================
    // FEATURE 6: Brave-style cleanup (sparse, debounced)
    // ============================================
    function cleanPageBraveStyle() {
        if (!settings.blockAds) return;
        const selectorsToHide = [
            '.adsbygoogle', '[class*="taboola"]', '[class*="outbrain"]', '[class*="mgid"]',
            '[data-google-query-id]', '.prime-widget', '.toi-video-widget',
            '[class*="daily-puzzles"]', '[class*="DailyPuzzles"]'
        ];
        const innerWidth = window.innerWidth;
        for (const selector of selectorsToHide) {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    if (el.dataset.pbHidden) return;
                    const rect = el.getBoundingClientRect();
                    if (rect.width > innerWidth * 0.6 && rect.height > 300) return;
                    if (el.closest('article, main, [role="main"], .article-body, .story-body, .post-content, .content-body')) return;
                    if (el.closest('nav, header')) return;
                    if (el.querySelector('article, [role="main"], .article-body')) return;
                    el.dataset.pbHidden = '1';
                    el.style.setProperty('display', 'none', 'important');
                });
            } catch (_) {}
        }
    }

    // ============================================
    // Mutation observer (idle-batched)
    // ============================================
    let scheduled = false;
    function scheduleAdRemoval() {
        if (scheduled) return;
        scheduled = true;
        const run = () => {
            scheduled = false;
            try { cleanPageBraveStyle(); } catch (_) {}
            try { handleCookieConsent(); } catch (_) {}
        };
        if (window.requestIdleCallback) {
            window.requestIdleCallback(run, { timeout: 1000 });
        } else {
            setTimeout(run, 250);
        }
    }

    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            let hasNewInputs = false;
            let interestingChange = false;

            for (let i = 0; i < mutations.length && !interestingChange; i++) {
                const m = mutations[i];
                for (let j = 0; j < m.addedNodes.length; j++) {
                    const n = m.addedNodes[j];
                    if (n.nodeType !== 1) continue;
                    if (n.tagName === 'INPUT' || (n.querySelector && n.querySelector('input'))) {
                        hasNewInputs = true;
                    }
                    const cls = (n.className && typeof n.className === 'string')
                        ? n.className.toLowerCase()
                        : '';
                    if (cls && (
                        cls.indexOf('cookie') !== -1 || cls.indexOf('consent') !== -1 ||
                        cls.indexOf('gdpr') !== -1 || cls.indexOf('ad') !== -1 ||
                        cls.indexOf('sponsor') !== -1 || cls.indexOf('taboola') !== -1 ||
                        cls.indexOf('outbrain') !== -1
                    )) {
                        interestingChange = true;
                        break;
                    }
                }
            }

            if (hasNewInputs && settings.scanForms) {
                setTimeout(scanFormFields, 200);
            }
            if (interestingChange) {
                scheduleAdRemoval();
            }
        });
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // ============================================
    // Init
    // ============================================
    function init() {
        loadSettings(() => {
            injectPageContext();
            injectHideCSS();
            removeContentRestrictions();

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', onReady);
            } else {
                onReady();
            }
        });
    }

    function onReady() {
        // Run cookie reject at staggered intervals (banners often appear late)
        setTimeout(handleCookieConsent, 500);
        setTimeout(handleCookieConsent, 2000);

        // Form scan + script analysis once
        setTimeout(scanFormFields, 1000);
        setTimeout(analyzeScripts, 1500);

        // Single delayed cleanup; MutationObserver handles the rest.
        setTimeout(cleanPageBraveStyle, 1500);

        observeDOM();
    }

    init();
})();
