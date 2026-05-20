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

    // If this content script is running INSIDE an ad-proxy iframe (TOI Colombia
    // network: html-load.com, content-loader.com), nuke the whole frame body.
    // Network blocking should have prevented load, but this is a safety net.
    const adProxyHostPattern = /(^|\.)(html-load|content-loader)\.com$/i;
    if (adProxyHostPattern.test(window.location.hostname || '')) {
        const killFrame = () => {
            try {
                if (document.documentElement) {
                    document.documentElement.style.setProperty('display', 'none', 'important');
                }
                if (document.body) {
                    document.body.innerHTML = '';
                    document.body.style.setProperty('display', 'none', 'important');
                }
            } catch (_) {}
        };
        killFrame();
        document.addEventListener('DOMContentLoaded', killFrame);
        return;
    }

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

        /* ---- Amazon Native Shopping Ads (product boxes in articles) ---- */
        [class*="amzn_assoc"], [id*="amzn_assoc"],
        .amzn_assoc_unit, .amzn_assoc_placement, .amzn_assoc_ad_unit,
        .amzn_assoc_widget_placement, .amzn_assoc_product_ad,
        iframe[src*="rcm-na.amazon-adsystem"],
        iframe[src*="rcm-eu.amazon-adsystem"],
        iframe[src*="rcm-fe.amazon-adsystem"],
        iframe[src*="rcm-in.amazon-adsystem"],
        iframe[src*="c.amazon-adsystem"],
        iframe[src*="ir-na.amazon-adsystem"],

        /* ---- Times of India (specific) ---- */
        [id^="div-gpt-ad"], [class^="div-gpt-ad"],
        .toi-ads-widget, .toi_ads_wrap, .toiArticleShowWidget,
        [class*="widget_ad"], [id*="widget_ad"],
        [class*="TOI_WIDGET"], [id*="TOI_WIDGET"],
        .toi-plus-widget, [class*="toiPlusWidget"],
        [id*="AdSlot"], [class*="AdSlot"],
        [id*="ad_slot"], [class*="ad_slot"],
        .listing-ad, .card-ad, [class*="listingAd"],

        /* ---- NDTV (specific) ---- */
        [id^="NDTV_Ads"], [id^="NDTV_Ad"], [class^="NDTV_Ad"],
        .ndtv_ads, .ndtv_adunit, .NDTV_adunit,
        [id*="Div_AdUnit"], [class*="Div_AdUnit"],
        [class*="Advert"]:not(article):not(section):not(p),
        [id*="Advert"]:not(article):not(section),
        .adblock-ad, .adBanner-wrap, [class*="adBanner"],
        [id*="RightRail"], [class*="rightRail"],

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
            '[data-google-query-id]', '[class*="amzn_assoc"]', '[id*="amzn_assoc"]',
            '.prime-widget', '.toi-video-widget',
            '[class*="daily-puzzles"]', '[class*="DailyPuzzles"]',
            '[id^="div-gpt-ad"]', '[id^="NDTV_Ads"]', '[id*="widget_ad"]'
        ];
        for (const selector of selectorsToHide) {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    if (el.dataset.pbHidden) return;
                    // Never hide nav/header
                    if (el.closest('nav, header')) return;
                    // Never hide if it's a real content container
                    if (el.querySelector('article, [role="main"]')) return;
                    el.dataset.pbHidden = '1';
                    el.style.setProperty('display', 'none', 'important');
                });
            } catch (_) {}
        }
    }

    // Find iframes loaded from known ad domains and hide their wrapping container
    const adIframeDomains = [
        'googlesyndication', 'doubleclick', 'amazon-adsystem', 'aps.amazon',
        'aax.amazon', 'taboola', 'outbrain', 'mgid', 'criteo', 'pubmatic',
        'rubiconproject', 'openx', 'adnxs', 'media.net', 'casalemedia',
        'contextweb', 'sharethrough', 'sovrn', 'triplelift', '33across',
        'colombiaonline', 'colombia.adgebra',
        // TOI ad-serving network (Colombia/RHN proxy — multiple rotating domains)
        'html-load.com', 'rhn.html-load', 'srv.html-load',
        'content-loader.com', 'tpc.googlesyndication'
    ];

    function hideAdIframes() {
        if (!settings.blockAds) return;
        document.querySelectorAll('iframe').forEach(iframe => {
            const src = iframe.src || iframe.getAttribute('src') || '';
            if (!src || iframe.dataset.pbHidden) return;
            if (!adIframeDomains.some(d => src.includes(d))) return;

            // Walk up max 6 levels to find the ad wrapper div
            let target = iframe;
            for (let i = 0; i < 6; i++) {
                const parent = target.parentElement;
                if (!parent || parent.tagName === 'BODY' || parent.tagName === 'HTML') break;
                if (parent.matches('nav, header')) break;
                if (parent.matches('article, main, [role="main"]')) {
                    // Ad is directly inside content — just hide the iframe itself
                    break;
                }
                target = parent;
            }
            if (target.dataset.pbHidden) return;
            target.dataset.pbHidden = '1';
            target.style.setProperty('display', 'none', 'important');
        });
    }

    // Hide containers wrapping images served from ad-proxy domains
    // (covers the case where the side ads aren't iframes — TOI renders the
    // image directly via JS using a src like 4.html-load.com/media/...)
    const adImageDomains = [
        'html-load.com', 'content-loader.com',
        'rcm-na.amazon-adsystem', 'rcm-eu.amazon-adsystem',
        'rcm-fe.amazon-adsystem', 'rcm-in.amazon-adsystem',
        'media-amazon.com', 'images-amazon.com'
    ];

    function hideAdProxyImages() {
        if (!settings.blockAds) return;
        document.querySelectorAll('img').forEach(img => {
            if (img.dataset.pbImgChecked) return;
            img.dataset.pbImgChecked = '1';
            const src = img.src || img.getAttribute('src') || img.currentSrc || '';
            if (!src) return;
            if (!adImageDomains.some(d => src.includes(d))) return;

            // Walk up to find the card wrapper. Stop at main content / nav.
            let target = img;
            for (let i = 0; i < 6; i++) {
                const parent = target.parentElement;
                if (!parent || parent === document.body || parent === document.documentElement) break;
                if (parent.matches('nav, header, footer')) break;
                if (parent.matches('article, main, [role="main"]')) break;
                target = parent;
            }
            if (target.dataset.pbHidden) return;
            target.dataset.pbHidden = '1';
            target.style.setProperty('display', 'none', 'important');
        });
    }

    // Hide sponsor-labeled product cards (the most reliable signal for
    // TOI's Colombia widgets: small text "Amazon"/"AliExpress" stamped under
    // each product, regardless of where the image is hosted).
    const sponsorLabelSet = new Set([
        'amazon', 'aliexpress', 'flipkart', 'tatacliq',
        'myntra', 'nykaa', 'shopsy', 'meesho', 'ajio'
    ]);

    function hideSponsorLabeledCards() {
        if (!settings.blockAds) return;
        const root = document.body || document.documentElement;
        if (!root) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const t = (node.textContent || '').trim();
                if (t.length < 5 || t.length > 15) return NodeFilter.FILTER_REJECT;
                return sponsorLabelSet.has(t.toLowerCase())
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        });

        const toHide = [];
        let node;
        while ((node = walker.nextNode())) {
            const labelEl = node.parentElement;
            if (!labelEl || labelEl.dataset.pbSponsorChecked) continue;
            labelEl.dataset.pbSponsorChecked = '1';

            // Skip if the label sits inside the main article body
            if (labelEl.closest('article, main, [role="main"], nav, header, footer')) continue;
            // Skip if the label has child elements (would be in article text, not a label)
            if (labelEl.children.length > 0) continue;

            // Walk up to find a card container that also has an image
            let card = labelEl;
            for (let i = 0; i < 6; i++) {
                const parent = card.parentElement;
                if (!parent || parent === document.body || parent === document.documentElement) break;
                if (parent.matches('article, main, [role="main"], nav, header, footer')) break;
                card = parent;
                if (parent.querySelector('img, picture')) break;
            }

            // Must contain an image (real product card)
            if (!card.querySelector('img, picture')) continue;
            // Card must be reasonably small (sidebar widget, not the whole page)
            const r = card.getBoundingClientRect();
            if (r.width === 0 || r.width > window.innerWidth * 0.5) continue;
            // Must not contain main article markers
            if (card.querySelector('article, main, [role="main"]')) continue;
            if (card.dataset.pbHidden) continue;

            toHide.push(card);
        }

        for (const el of toHide) {
            el.dataset.pbHidden = '1';
            el.style.setProperty('display', 'none', 'important');
        }
    }

    // Hide sidebar product cards that link to affiliate/shopping domains
    // (TOI Colombia ads, Amazon/AliExpress affiliate widgets)
    const affiliateDomains = [
        'amazon.com/', 'amazon.in/', 'amzn.to/', 'amzn.in/',
        'aliexpress.com/', 'aliexpress.us/', 's.click.aliexpress',
        '/affiliate/', '/aff/', 'colombia.adgebra', 'colombiaonline',
        'tatacliq.com', 'flipkart.com/affiliate',
        // TOI ad proxy (links go through these before redirecting to merchant)
        'html-load.com', '.html-load.com',
        'content-loader.com', '.content-loader.com'
    ];

    function hideAffiliateProductCards() {
        if (!settings.blockAds) return;
        const host = window.location.hostname;
        // Don't touch the merchant's own site (e.g. on amazon.in itself)
        if (/amazon\.|aliexpress\.|flipkart\./.test(host)) return;

        document.querySelectorAll('a[href]').forEach(link => {
            if (link.dataset.pbChecked && link.dataset.pbHidden) return;
            link.dataset.pbChecked = '1';
            const href = link.href || '';
            if (!affiliateDomains.some(d => href.includes(d))) return;
            // Skip links inside main article body — they may be legitimate references
            if (link.closest('article p, .article-body p, .story-content p, [role="main"] p')) return;

            // If the <a> itself wraps the card (image + content), hide it directly
            if (link.querySelector('img')) {
                link.dataset.pbHidden = '1';
                link.style.setProperty('display', 'none', 'important');
                return;
            }

            // Walk up to find the product card container (has image + small text)
            let target = link;
            for (let i = 0; i < 5; i++) {
                const parent = target.parentElement;
                if (!parent || parent.tagName === 'BODY' || parent.tagName === 'HTML') break;
                if (parent.matches('nav, header, footer')) break;
                if (parent.matches('article, main, [role="main"]')) break;
                target = parent;
                // If this container has an image and not too much else, it's the card
                if (parent.querySelector('img') && parent.children.length <= 6) break;
            }
            if (target.dataset.pbHidden) return;
            target.dataset.pbHidden = '1';
            target.style.setProperty('display', 'none', 'important');
        });
    }

    // Detect and remove anti-adblock overlay modals ("Please allow ads on our site")
    const antiAdblockPhrases = [
        'please allow ads',
        'allow ads on our site',
        'failed to load website properly',
        'support us by disabling',
        'please disable your ad',
        'disable your adblocker',
        'disable your ad blocker',
        'turn off your ad blocker',
        'whitelist our site',
        'we noticed you have an ad blocker',
        'we have detected an ad blocker',
        'please consider allowing ads',
        'please allow ads to support',
        'ads enabled to continue',
        'ads are blocked',
        'ad blocker detected'
    ];

    function removeAntiAdblockOverlays() {
        if (!settings.blockAds) return;

        document.querySelectorAll('dialog, [role="dialog"], [role="alertdialog"], aside, div, section').forEach(el => {
            if (el.dataset.pbAdblockHidden) return;
            const rect = el.getBoundingClientRect();
            // Must be sizeable AND look modal-ish (not a tiny notice)
            if (rect.width < 250 || rect.height < 100) return;

            const text = (el.textContent || '').toLowerCase().slice(0, 500);
            if (!antiAdblockPhrases.some(p => text.includes(p))) return;

            // Safety: never hide a container that holds the main content
            if (el.querySelector('article, main, [role="main"]')) return;
            // Safety: never hide a container with many links (nav, sitemap, etc.)
            if (el.querySelectorAll('a').length > 15) return;
            // Safety: never hide if larger than 90% of viewport (we'd nuke the page)
            if (rect.width > window.innerWidth * 0.95 && rect.height > window.innerHeight * 0.95) return;

            // Try to find a fixed-position parent (the modal backdrop). Only
            // climb if we find one — never walk past it blindly.
            let target = el;
            let walker = el.parentElement;
            let levels = 0;
            while (walker && walker !== document.body && walker !== document.documentElement && levels < 4) {
                const ps = window.getComputedStyle(walker);
                if (ps.position === 'fixed' && walker.querySelectorAll('a').length <= 15) {
                    // Same safety: only target fixed wrapper if it doesn't contain main content
                    if (!walker.querySelector('article, main, [role="main"]')) {
                        target = walker;
                    }
                    break;
                }
                walker = walker.parentElement;
                levels++;
            }
            target.dataset.pbAdblockHidden = '1';
            target.style.setProperty('display', 'none', 'important');
        });

        // Restore scrolling only — don't touch position/height which breaks
        // CSS-in-JS layouts (TOI uses these for nested positioning).
        try {
            const htmlStyle = document.documentElement.style;
            if (htmlStyle.overflow === 'hidden' || getComputedStyle(document.documentElement).overflow === 'hidden') {
                htmlStyle.setProperty('overflow', 'auto', 'important');
            }
            if (document.body) {
                const bodyStyle = document.body.style;
                if (bodyStyle.overflow === 'hidden' || getComputedStyle(document.body).overflow === 'hidden') {
                    bodyStyle.setProperty('overflow', 'auto', 'important');
                }
            }
        } catch (_) {}
    }

    // Hide sticky/floating video players in viewport corners (common ad pattern)
    function hideStickyFloatingPlayers() {
        if (!settings.blockAds) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        document.querySelectorAll('div, aside, section').forEach(el => {
            if (el.dataset.pbHidden) return;
            const style = window.getComputedStyle(el);
            if (style.position !== 'fixed' && style.position !== 'sticky') return;

            const rect = el.getBoundingClientRect();
            // Must be small-to-medium (not full overlays/modals)
            if (rect.width === 0 || rect.height === 0) return;
            if (rect.width > vw * 0.6) return;
            if (rect.height > vh * 0.6) return;
            if (rect.width < 150 || rect.height < 80) return;

            // Must be near a corner
            const nearLeft = rect.left < 30;
            const nearRight = rect.right > vw - 30;
            const nearBottom = rect.bottom > vh - 30;
            const nearTop = rect.top < 30;
            const inCorner = (nearLeft || nearRight) && (nearBottom || nearTop);
            if (!inCorner) return;

            // Skip nav/header/footer and cookie banners (we don't double-hide)
            if (el.closest('nav, header, footer')) return;

            // Detect player/ad characteristics:
            const hasMedia = el.querySelector('video, iframe, audio');
            const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const looksLikePlayer = /video|player|sticky|float|popup|widget|ad/.test(cls + ' ' + id);
            // Video-aspect ratio (16:9, 4:3) suggests an embedded video popup
            const aspectRatio = rect.width / rect.height;
            const isVideoAspect = aspectRatio > 1.2 && aspectRatio < 2.5;
            // Video popups often have a close (X) button + media controls
            const txt = (el.textContent || '').toLowerCase();
            const hasPlayerText = /now playing|tap to unmute|unmute|skip ad|advertisement/.test(txt);
            // Has a close button structure
            const hasCloseAndButtons = el.querySelectorAll('button, [role="button"], svg').length >= 2;

            const isLikelyAdPopup =
                hasMedia ||
                looksLikePlayer ||
                hasPlayerText ||
                (isVideoAspect && hasCloseAndButtons);

            if (!isLikelyAdPopup) return;

            el.dataset.pbHidden = '1';
            el.style.setProperty('display', 'none', 'important');
        });
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
            try { removeAntiAdblockOverlays(); } catch (_) {}
            try { cleanPageBraveStyle(); } catch (_) {}
            try { hideAdIframes(); } catch (_) {}
            try { hideAdProxyImages(); } catch (_) {}
            try { hideSponsorLabeledCards(); } catch (_) {}
            try { hideAffiliateProductCards(); } catch (_) {}
            try { hideStickyFloatingPlayers(); } catch (_) {}
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
                    // Any new iframe or img is a strong signal — TOI lazy-loads
                    // ad widgets after initial render and our class-name
                    // heuristics won't match their random-hash wrappers.
                    if (n.tagName === 'IFRAME' || n.tagName === 'IMG' ||
                        (n.querySelector && n.querySelector('iframe, img'))) {
                        interestingChange = true;
                        break;
                    }
                    if (cls && (
                        cls.indexOf('cookie') !== -1 || cls.indexOf('consent') !== -1 ||
                        cls.indexOf('gdpr') !== -1 || cls.indexOf('ad') !== -1 ||
                        cls.indexOf('sponsor') !== -1 || cls.indexOf('taboola') !== -1 ||
                        cls.indexOf('outbrain') !== -1 || cls.indexOf('amzn') !== -1 ||
                        cls.indexOf('amazon') !== -1
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
        const sweep = () => {
            try { hideAdIframes(); } catch (_) {}
            try { hideAdProxyImages(); } catch (_) {}
            try { hideSponsorLabeledCards(); } catch (_) {}
            try { hideAffiliateProductCards(); } catch (_) {}
            try { hideStickyFloatingPlayers(); } catch (_) {}
        };
        setTimeout(sweep, 1500);
        setTimeout(sweep, 3000);
        setTimeout(sweep, 5000);
        setTimeout(sweep, 8000);
        setTimeout(sweep, 12000);

        // Defense in depth: if any anti-adblock modal slips through, the
        // MutationObserver will catch it via removeAntiAdblockOverlays().
        // No tight polling here — we're relying on iframe nukes, not network
        // blocking, so the page should render cleanly without triggering
        // anti-adblock detection.

        observeDOM();
    }

    init();
})();
