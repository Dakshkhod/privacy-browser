// Privacy Browser - Content Script
// Features: Ad blocking, Cookie consent auto-reject, Form field scanner, Script analyzer

(function () {
    'use strict';

    // ============================================
    // Configuration
    // ============================================
    let settings = {
        autoRejectCookies: true,
        scanForms: true,
        blockAds: true
    };

    // Load settings from storage
    chrome.storage.local.get(['privacySettings']).then(result => {
        if (result.privacySettings) {
            settings = { ...settings, ...result.privacySettings };
        }
    }).catch(() => { });

    // ============================================
    // FEATURE 1: Cookie Consent Auto-Rejector
    // ============================================

    // Common patterns for cookie consent dialogs
    const cookieSelectors = {
        // Common cookie banner containers
        banners: [
            '[class*="cookie-banner"]',
            '[class*="cookie-consent"]',
            '[class*="cookie-notice"]',
            '[class*="cookie-popup"]',
            '[class*="cookieBanner"]',
            '[class*="consent-banner"]',
            '[class*="consent-popup"]',
            '[class*="gdpr-banner"]',
            '[class*="gdpr-consent"]',
            '[id*="cookie-banner"]',
            '[id*="cookie-consent"]',
            '[id*="cookieConsent"]',
            '[id*="gdpr"]',
            '[class*="cc-banner"]',
            '[class*="cc-window"]',
            '#onetrust-banner-sdk',
            '#CybotCookiebotDialog',
            '.osano-cm-window',
            '[class*="truste"]',
            '[class*="evidon"]',
            '[aria-label*="cookie"]',
            '[aria-label*="consent"]'
        ],

        // Reject/Decline button patterns
        rejectButtons: [
            // Text-based selectors
            'button[class*="reject"]',
            'button[class*="decline"]',
            'button[class*="deny"]',
            'button[class*="refuse"]',
            'a[class*="reject"]',
            'a[class*="decline"]',
            '[class*="reject-all"]',
            '[class*="decline-all"]',
            '[class*="deny-all"]',
            '#onetrust-reject-all-handler',
            '.cc-deny',
            '[data-action="reject"]',
            '[data-consent="reject"]',
            'button[title*="Reject"]',
            'button[title*="Decline"]'
        ],

        // "Necessary only" / "Essential only" buttons
        essentialButtons: [
            '[class*="necessary-only"]',
            '[class*="essential-only"]',
            '[class*="required-only"]',
            'button[class*="necessary"]',
            '[id*="necessary"]'
        ],

        // Close/dismiss buttons (fallback)
        closeButtons: [
            '[class*="cookie"] [class*="close"]',
            '[class*="consent"] [class*="close"]',
            '[class*="cookie"] button[aria-label="Close"]',
            '.cc-close'
        ]
    };

    // Text patterns for reject buttons
    const rejectTextPatterns = [
        'reject all', 'reject', 'decline all', 'decline', 'deny all', 'deny',
        'refuse all', 'refuse', 'no thanks', 'no, thanks', 'only necessary',
        'necessary only', 'essential only', 'nur notwendige', 'ablehnen',
        'refuser', 'rechazar', 'rifiuta'
    ];

    // Text patterns to AVOID (accept buttons)
    const acceptTextPatterns = [
        'accept all', 'accept', 'agree', 'allow all', 'allow', 'got it',
        'i understand', 'ok', 'okay', 'continue', 'yes'
    ];

    function handleCookieConsent() {
        if (!settings.autoRejectCookies) return;

        // Try to find and click reject button
        let clicked = false;

        // First, try specific reject button selectors
        for (const selector of cookieSelectors.rejectButtons) {
            const btn = document.querySelector(selector);
            if (btn && isVisible(btn)) {
                btn.click();
                clicked = true;
                console.log('Privacy Browser: Rejected cookies via selector');
                notifyBackgroundCookieRejected();
                return;
            }
        }

        // Try essential-only buttons
        for (const selector of cookieSelectors.essentialButtons) {
            const btn = document.querySelector(selector);
            if (btn && isVisible(btn)) {
                btn.click();
                clicked = true;
                console.log('Privacy Browser: Selected essential cookies only');
                notifyBackgroundCookieRejected();
                return;
            }
        }

        // Try to find buttons by text content
        const allButtons = document.querySelectorAll('button, a[role="button"], [class*="btn"]');
        for (const btn of allButtons) {
            const text = btn.textContent.toLowerCase().trim();

            // Skip if it looks like an accept button
            if (acceptTextPatterns.some(p => text === p || text.startsWith(p))) continue;

            // Check if it's a reject button by text
            if (rejectTextPatterns.some(p => text === p || text.includes(p))) {
                if (isVisible(btn)) {
                    btn.click();
                    console.log('Privacy Browser: Rejected cookies via text match:', text);
                    notifyBackgroundCookieRejected();
                    return;
                }
            }
        }

        // Fallback: try to close the banner
        for (const selector of cookieSelectors.closeButtons) {
            const btn = document.querySelector(selector);
            if (btn && isVisible(btn)) {
                btn.click();
                console.log('Privacy Browser: Closed cookie banner');
                notifyBackgroundCookieRejected();
                return;
            }
        }
    }

    function isVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            el.offsetParent !== null;
    }

    function notifyBackgroundCookieRejected() {
        chrome.runtime.sendMessage({
            type: 'COOKIE_REJECTED',
            domain: window.location.hostname
        }).catch(() => { });
    }

    // ============================================
    // FEATURE 2: Form Field Privacy Scanner
    // ============================================

    const sensitiveFieldPatterns = {
        ssn: {
            patterns: ['ssn', 'social-security', 'socialsecurity', 'social_security'],
            label: 'SSN',
            risk: 'critical',
            icon: '🔴'
        },
        creditCard: {
            patterns: ['card-number', 'cardnumber', 'cc-number', 'ccnumber', 'credit-card', 'creditcard', 'payment-card'],
            label: 'Credit Card',
            risk: 'critical',
            icon: '🔴'
        },
        cvv: {
            patterns: ['cvv', 'cvc', 'security-code', 'securitycode', 'card-code'],
            label: 'CVV',
            risk: 'critical',
            icon: '🔴'
        },
        passport: {
            patterns: ['passport', 'passport-number'],
            label: 'Passport',
            risk: 'high',
            icon: '🟠'
        },
        dob: {
            patterns: ['dob', 'date-of-birth', 'dateofbirth', 'birth-date', 'birthdate'],
            label: 'Date of Birth',
            risk: 'medium',
            icon: '🟡'
        },
        phone: {
            patterns: ['phone', 'mobile', 'tel', 'cell'],
            label: 'Phone',
            risk: 'low',
            icon: '🟢'
        },
        address: {
            patterns: ['address', 'street', 'city', 'zip', 'postal'],
            label: 'Address',
            risk: 'low',
            icon: '🟢'
        }
    };

    function scanFormFields() {
        if (!settings.scanForms) return;

        const sensitiveFields = [];
        const inputs = document.querySelectorAll('input, textarea, select');
        const isSecure = window.location.protocol === 'https:';

        inputs.forEach(input => {
            const fieldInfo = getFieldInfo(input);
            const matchedType = detectSensitiveField(fieldInfo);

            if (matchedType) {
                sensitiveFields.push({
                    element: input,
                    type: matchedType,
                    info: sensitiveFieldPatterns[matchedType],
                    isSecure: isSecure
                });

                // Add visual indicator
                addFieldWarning(input, sensitiveFieldPatterns[matchedType], isSecure);
            }
        });

        // Send results to background
        if (sensitiveFields.length > 0) {
            chrome.runtime.sendMessage({
                type: 'SENSITIVE_FIELDS_DETECTED',
                domain: window.location.hostname,
                isSecure: isSecure,
                fields: sensitiveFields.map(f => ({
                    type: f.type,
                    label: f.info.label,
                    risk: f.info.risk,
                    isSecure: f.isSecure
                }))
            }).catch(() => { });
        }

        return sensitiveFields;
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

    function getLabelText(input) {
        // Try to find associated label
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.textContent || '';
        }
        // Check parent label
        const parentLabel = input.closest('label');
        if (parentLabel) return parentLabel.textContent || '';
        return '';
    }

    function detectSensitiveField(fieldInfo) {
        const allText = Object.values(fieldInfo).join(' ');

        for (const [type, config] of Object.entries(sensitiveFieldPatterns)) {
            for (const pattern of config.patterns) {
                if (allText.includes(pattern)) {
                    return type;
                }
            }
        }

        // Check input type
        if (fieldInfo.type === 'tel') return 'phone';
        if (fieldInfo.autocomplete.includes('cc-')) return 'creditCard';

        return null;
    }

    function addFieldWarning(input, fieldType, isSecure) {
        // Don't add duplicate warnings
        if (input.dataset.privacyScanned) return;
        input.dataset.privacyScanned = 'true';

        // Create warning badge
        const badge = document.createElement('div');
        badge.className = 'privacy-browser-field-warning';
        badge.innerHTML = `${fieldType.icon} ${fieldType.label}`;
        badge.title = isSecure
            ? `This field collects ${fieldType.label} data`
            : `⚠️ WARNING: ${fieldType.label} on insecure page!`;

        // Style the badge
        badge.style.cssText = `
            position: absolute;
            top: -20px;
            right: 0;
            background: ${isSecure ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            z-index: 10000;
            pointer-events: none;
        `;

        // Wrap input if needed
        const wrapper = input.parentElement;
        if (wrapper && getComputedStyle(wrapper).position === 'static') {
            wrapper.style.position = 'relative';
        }

        if (wrapper) {
            wrapper.style.position = 'relative';
            wrapper.appendChild(badge);
        }

        // Highlight insecure sensitive fields
        if (!isSecure && (fieldType.risk === 'critical' || fieldType.risk === 'high')) {
            input.style.border = '2px solid #ef4444';
            input.style.boxShadow = '0 0 5px rgba(239, 68, 68, 0.5)';
        }
    }

    // ============================================
    // FEATURE 3: Third-Party Script Analyzer
    // ============================================

    function analyzeScripts() {
        const scripts = [];
        const currentDomain = window.location.hostname;

        // Get all script elements
        document.querySelectorAll('script[src]').forEach(script => {
            try {
                const url = new URL(script.src, window.location.origin);
                const scriptDomain = url.hostname;

                // Check if third-party
                if (!scriptDomain.includes(currentDomain) && !currentDomain.includes(scriptDomain)) {
                    scripts.push({
                        domain: scriptDomain,
                        url: script.src,
                        async: script.async,
                        defer: script.defer
                    });
                }
            } catch (e) { }
        });

        // Send to background for categorization
        if (scripts.length > 0) {
            chrome.runtime.sendMessage({
                type: 'SCRIPTS_ANALYZED',
                domain: window.location.hostname,
                scripts: scripts
            }).catch(() => { });
        }

        return scripts;
    }

    // ============================================
    // FEATURE 4: Ad Blocking (Enhanced)
    // ============================================

    const hideCSS = `
        /* ==========================================
           UNIVERSAL AD HIDING CSS
           Works across all websites
           ========================================== */

        /* Generic Ad Containers - Class Based */
        [class*="ad-container"],
        [class*="ad_container"],
        [class*="adContainer"],
        [class*="ad-wrapper"],
        [class*="ad_wrapper"],
        [class*="adWrapper"],
        [class*="ad-box"],
        [class*="ad_box"],
        [class*="adBox"],
        [class*="ad-unit"],
        [class*="ad_unit"],
        [class*="adUnit"],
        [class*="ad-slot"],
        [class*="ad_slot"],
        [class*="adSlot"],
        [class*="ad-banner"],
        [class*="ad_banner"],
        [class*="adBanner"],
        [class*="ad-block"],
        [class*="ad_block"],
        [class*="adBlock"],
        [class*="ad-frame"],
        [class*="ad_frame"],
        [class*="adFrame"],
        [class*="ad-placement"],
        [class*="ad_placement"],
        [class*="adPlacement"],
        [class*="ad-zone"],
        [class*="ad_zone"],
        [class*="adZone"],
        [class*="ad-space"],
        [class*="ad_space"],
        [class*="adSpace"],
        [class*="ad-region"],
        [class*="ad-holder"],
        [class*="ad-insert"],
        [class*="ad-label"],
        
        /* Generic Ad Containers - ID Based */
        [id*="ad-container"],
        [id*="ad_container"],
        [id*="adContainer"],
        [id*="ad-wrapper"],
        [id*="ad_wrapper"],
        [id*="adWrapper"],
        [id*="ad-box"],
        [id*="ad_box"],
        [id*="adBox"],
        [id*="ad-unit"],
        [id*="ad_unit"],
        [id*="adUnit"],
        [id*="ad-slot"],
        [id*="ad_slot"],
        [id*="adSlot"],
        [id*="ad-banner"],
        [id*="ad_banner"],
        [id*="adBanner"],
        [id*="ad-frame"],
        [id*="ad_frame"],
        [id*="adFrame"],
        [id*="google_ads"],
        [id*="googleAds"],
        [id*="div-gpt-ad"],
        
        /* Data Attribute Based */
        [data-ad],
        [data-ad-slot],
        [data-ad-unit],
        [data-ad-client],
        [data-ad-channel],
        [data-ad-format],
        [data-ad-layout],
        [data-adservice],
        [data-google-query-id],
        [data-freestar-ad],
        [data-taboola],
        [data-outbrain],
        [data-native-ad],
        
        /* ==========================================
           AFFILIATE & SHOPPING ADS
           ========================================== */
        
        /* Shopping/Affiliate Widgets */
        [class*="shop-the-story"],
        [class*="shopTheStory"],
        [class*="shop_the_story"],
        [class*="shopping-widget"],
        [class*="shoppingWidget"],
        [class*="product-carousel"],
        [class*="productCarousel"],
        [class*="product-widget"],
        [class*="productWidget"],
        [class*="affiliate-widget"],
        [class*="affiliateWidget"],
        [class*="affiliate-links"],
        [class*="affiliate-products"],
        [class*="buy-now-widget"],
        [class*="commerce-widget"],
        [class*="ecommerce-widget"],
        [class*="shopping-carousel"],
        [class*="product-recommendations"],
        [class*="recommended-products"],
        [class*="product-ads"],
        [class*="shopping-ads"],
        
        /* Amazon Affiliate Specific */
        [class*="amazon-widget"],
        [class*="amazonWidget"],
        [class*="amazon-products"],
        [class*="amazon-affiliate"],
        [class*="amzn-native"],
        [class*="amazon-carousel"],
        [id*="amazon-widget"],
        [id*="amzn"],
        [data-amazon],
        [data-affiliate],
        iframe[src*="amazon"],
        iframe[src*="amzn"],
        a[href*="amazon"][href*="tag="],
        
        /* Flipkart Affiliate */
        [class*="flipkart-widget"],
        [class*="flipkart-affiliate"],
        iframe[src*="flipkart"],
        
        /* Sponsored/Native Content */
        [class*="sponsored"],
        [class*="Sponsored"],
        [class*="promoted"],
        [class*="Promoted"],
        [class*="native-ad"],
        [class*="nativeAd"],
        [class*="content-ad"],
        [class*="contentAd"],
        [class*="partner-content"],
        [class*="paid-content"],
        [class*="commercial"],
        [class*="branded-content"],
        [class*="advertorial"],
        [class*="promo-widget"],
        [class*="promotional"],
        
        /* Elements containing "Sponsored" text - more specific targeting */
        div:has(> span:contains("Sponsored")),
        section:has(> *:contains("Sponsored")),
        
        /* ==========================================
           INDIAN NEWS SITES SPECIFIC
           (Hindustan Times, TOI, etc.)
           ========================================== */
        
        /* Hindustan Times */
        .storyShopWidget,
        .story-shop-widget,
        [class*="story-shop"],
        [class*="storyShop"],
        .ht-ad,
        .ht-ads,
        [class*="ht-ad-"],
        .rightAdsDiv,
        .leftAdsDiv,
        .bottomAdsDiv,
        .topAdsDiv,
        .mobileAdSlot,
        .desktopAdSlot,
        [class*="htBottomAd"],
        [class*="htTopAd"],
        [class*="htSideAd"],
        .widget-container[class*="shop"],
        .widget-container[class*="product"],
        
        /* Times of India - Conservative targeting */
        .toi-ad,
        .toiAd,
        .prime-widget,
        .toi-video-widget,
        .toi_advt,
        .adDiv,
        .adbox,
        .sponsoredContent,
        .RHS_ads,
        .rhs_ad,
        .rightSidebarAd,
        .right-sidebar-ad,
        
        /* NDTV */
        .ndtv-ad,
        [class*="ndtv-ad"],
        [class*="ndtvAd"],
        .gadgets-widget,
        
        /* India Today */
        .it-ad,
        [class*="it-ad"],
        .newskarma,
        
        /* Economic Times */
        .et-ad,
        [class*="et-ad"],
        
        /* News18 */
        .news18-ad,
        [class*="news18-ad"],
        
        /* ==========================================
           VIDEO ADS & OVERLAYS
           ========================================== */
        
        [class*="video-ad"],
        [class*="videoAd"],
        [class*="video_ad"],
        [class*="video-popup"],
        [class*="video-overlay"],
        [class*="floating-video"],
        [class*="sticky-video"],
        [class*="primis"],
        [class*="connatix"],
        [class*="vdo-ai"],
        [class*="vidoomy"],
        [class*="outstream"],
        [class*="preroll"],
        [class*="postroll"],
        [class*="midroll"],
        [id*="primis"],
        [id*="connatix"],
        .jwplayer [class*="ad"],
        .video-js [class*="ad"],
        
        /* Floating/Sticky Video Players (bottom-right popups) */
        [class*="sticky-player"],
        [class*="stickyPlayer"],
        [class*="sticky_player"],
        [class*="floating-player"],
        [class*="floatingPlayer"],
        [class*="floating_player"],
        [class*="pip-player"],
        [class*="pipPlayer"],
        [class*="mini-player"],
        [class*="miniPlayer"],
        [class*="corner-video"],
        [class*="cornerVideo"],
        [class*="video-float"],
        [class*="videoFloat"],
        [class*="persist-video"],
        [class*="persistVideo"],
        [class*="detached-video"],
        [class*="detachedVideo"],
        [class*="docked-video"],
        [class*="dockedVideo"],
        [class*="minimized-video"],
        [class*="minimizedVideo"],
        [class*="video-sticky"],
        [class*="videoSticky"],
        [class*="jw-float"],
        [class*="vjs-floating"],
        div[style*="position: fixed"][style*="bottom"][style*="right"] video,
        div[style*="position:fixed"][style*="bottom"][style*="right"] video,
        
        /* ==========================================
           POPUP & OVERLAY ADS
           ========================================== */
        
        [class*="popup-ad"],
        [class*="popupAd"],
        [class*="popup_ad"],
        [class*="modal-ad"],
        [class*="modalAd"],
        [class*="overlay-ad"],
        [class*="overlayAd"],
        [class*="interstitial"],
        [class*="lightbox-ad"],
        [class*="splash-ad"],
        [class*="welcome-ad"],
        
        /* ==========================================
           FLOATING & STICKY ADS
           ========================================== */
        
        [class*="floating-ad"],
        [class*="floatingAd"],
        [class*="sticky-ad"],
        [class*="stickyAd"],
        [class*="fixed-ad"],
        [class*="fixedAd"],
        [class*="bottom-ad"],
        [class*="bottomAd"],
        [class*="top-ad"],
        [class*="topAd"],
        [class*="side-ad"],
        [class*="sideAd"],
        [class*="rail-ad"],
        [class*="sidebar-ad"],
        [class*="footer-ad"],
        [class*="header-ad"],
        
        /* ==========================================
           AD NETWORKS
           ========================================== */
        
        .adsbygoogle,
        .google-ad,
        .gpt-ad,
        .dfp-ad,
        .taboola,
        .taboola-widget,
        .taboola-container,
        [class*="taboola"],
        .outbrain,
        .outbrain-widget,
        [class*="outbrain"],
        .mgid,
        .mgid-widget,
        [class*="mgid"],
        .revcontent,
        .content-ad,
        .criteo,
        .amazon-ad,
        .adsense,
        .colombia,
        [class*="colombia"],
        
        /* ==========================================
           NEWSLETTER & SUBSCRIBE POPUPS
           ========================================== */
        
        [class*="newsletter-popup"],
        [class*="newsletter-modal"],
        [class*="subscribe-popup"],
        [class*="subscribe-modal"],
        [class*="email-popup"],
        [class*="signup-popup"],
        [class*="notification-bar"]:not(nav *),
        [class*="push-notification"],
        [class*="app-download"],
        [class*="download-app"],
        
        /* ==========================================
           IFRAMES & EMBEDDED ADS
           ========================================== */
        
        iframe[src*="ads"],
        iframe[src*="doubleclick"],
        iframe[src*="googlesyndication"],
        iframe[src*="taboola"],
        iframe[src*="outbrain"],
        iframe[src*="mgid"],
        iframe[src*="amazon-adsystem"],
        iframe[src*="primis"],
        iframe[src*="connatix"],
        iframe[id*="google_ads_iframe"],
        iframe[name*="google_ads"],
        
        /* ==========================================
           ADDITIONAL PATTERNS
           ========================================== */
        
        [aria-label*="advertisement"],
        [aria-label*="Advertisement"],
        [aria-label*="Sponsored"],
        [aria-label*="Shopping"],
        [role="complementary"][class*="ad"],
        ins.adsbygoogle,
        amp-ad,
        amp-embed,
        amp-sticky-ad,
        
        /* Buy buttons in article context */
        .article-body [class*="buy-now"],
        .article-content [class*="shop"],
        .story-body [class*="product"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
        }
        
        /* Remove empty ad containers spacing */
        [class*="ad-container"]:empty,
        [class*="ad-wrapper"]:empty,
        [class*="ad-slot"]:empty {
            margin: 0 !important;
            padding: 0 !important;
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
    // FEATURE 5: Anti-Adblock Bypass
    // ============================================

    function bypassAdblockDetection() {
        if (!settings.blockAds) return;

        // Create a script to inject into the page context
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                'use strict';
                
                // Override common adblock detection variables
                const adblockProps = [
                    'adBlockEnabled', 'adBlockDetected', 'adblockEnabled', 'adblockDetected',
                    'isAdBlockActive', 'adBlockActive', 'blockAdBlock', 'canRunAds',
                    'adsBlocked', 'noAdBlock', 'adBlocker', 'hasAdBlock', 'showAds',
                    'adsEnabled', 'adBlockerDetected', 'adBlockDetection'
                ];
                
                adblockProps.forEach(prop => {
                    try {
                        Object.defineProperty(window, prop, {
                            get: () => prop.includes('canRun') || prop.includes('show') || prop.includes('Enabled') || prop === 'noAdBlock' ? true : false,
                            set: () => {},
                            configurable: false
                        });
                    } catch(e) {}
                });

                // Create fake ad element for detection bypass
                const fakeAd = document.createElement('div');
                fakeAd.className = 'adsbox ad-placeholder pub_300x250';
                fakeAd.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
                fakeAd.innerHTML = '&nbsp;';
                document.documentElement.appendChild(fakeAd);

                // Prevent adblock detection via element check
                const originalGetComputedStyle = window.getComputedStyle;
                window.getComputedStyle = function(element, pseudoElt) {
                    const result = originalGetComputedStyle.call(this, element, pseudoElt);
                    if (element && element.className && typeof element.className === 'string') {
                        const className = element.className.toLowerCase();
                        if (className.includes('ads') || className.includes('ad-') || className.includes('banner')) {
                            return new Proxy(result, {
                                get: (target, prop) => {
                                    if (prop === 'display') return 'block';
                                    if (prop === 'visibility') return 'visible';
                                    if (prop === 'height' || prop === 'width') return '1px';
                                    return target[prop];
                                }
                            });
                        }
                    }
                    return result;
                };

                // Neutralize common detection functions
                const neutralize = (obj, methods) => {
                    methods.forEach(method => {
                        try {
                            if (typeof obj[method] === 'function') {
                                const original = obj[method];
                                obj[method] = function() {
                                    const args = Array.from(arguments);
                                    const fnStr = args[0] ? args[0].toString().toLowerCase() : '';
                                    if (fnStr.includes('adblock') || fnStr.includes('ads') || fnStr.includes('blocker')) {
                                        return method === 'setTimeout' || method === 'setInterval' ? 0 : undefined;
                                    }
                                    return original.apply(this, arguments);
                                };
                            }
                        } catch(e) {}
                    });
                };

                // Override eval to prevent obfuscated detection
                const originalEval = window.eval;
                window.eval = function(code) {
                    if (typeof code === 'string') {
                        const lowerCode = code.toLowerCase();
                        if (lowerCode.includes('adblock') || lowerCode.includes('blockad')) {
                            return undefined;
                        }
                    }
                    return originalEval.call(this, code);
                };

                console.log('Privacy Browser: Anti-adblock bypass active');
            })();
        `;

        // Inject at document_start to run before page scripts
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }

    // ============================================
    // FEATURE 6: Content Restriction Remover
    // ============================================

    function removeContentRestrictions() {
        if (!settings.blockAds) return;

        // 1. Remove scroll lock
        const enableScroll = () => {
            document.body.style.overflow = 'auto';
            document.body.style.overflowY = 'auto';
            document.documentElement.style.overflow = 'auto';
            document.documentElement.style.overflowY = 'auto';
            document.body.style.position = 'static';
            document.documentElement.style.position = 'static';
        };

        // 2. Remove blur effects on content
        const removeBlur = () => {
            document.querySelectorAll('[style*="blur"]').forEach(el => {
                el.style.filter = 'none';
                el.style.webkitFilter = 'none';
            });
            document.querySelectorAll('[class*="blur"], [class*="paywall"], [class*="premium-content"], [class*="subscriber-only"]').forEach(el => {
                el.style.filter = 'none';
                el.style.webkitFilter = 'none';
            });
        };

        // 3. Re-enable text selection and copy
        const enableCopy = () => {
            document.body.style.userSelect = 'auto';
            document.body.style.webkitUserSelect = 'auto';
            document.documentElement.style.userSelect = 'auto';

            // Remove nocopy handlers
            ['copy', 'cut', 'contextmenu', 'selectstart', 'mousedown', 'mouseup', 'keydown'].forEach(event => {
                document.addEventListener(event, e => e.stopPropagation(), true);
            });
        };

        // 4. Remove overlay modals (adblock walls, subscription walls)
        const removeOverlays = () => {
            const overlaySelectors = [
                '[class*="adblock-modal"]',
                '[class*="adblock-overlay"]',
                '[class*="adblock-wall"]',
                '[class*="adblock-notice"]',
                '[class*="adblocker-modal"]',
                '[class*="paywall-modal"]',
                '[class*="paywall-overlay"]',
                '[class*="subscription-wall"]',
                '[class*="subscriber-wall"]',
                '[class*="piano-modal"]',
                '[class*="tp-modal"]',
                '[class*="regwall"]',
                '[class*="login-wall"]',
                '[class*="gate-overlay"]',
                '[class*="content-gate"]',
                '[id*="adblock-modal"]',
                '[id*="paywall"]',
                '[id*="piano-"]',
                '.fc-ab-root',
                '.fc-dialog-container',
                '#credential_picker_container'
            ];

            overlaySelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.display = 'none';
                    el.remove();
                });
            });
        };

        // 5. Unhide truncated content
        const unhideContent = () => {
            document.querySelectorAll('[class*="truncate"], [class*="fade-out"], [class*="content-fade"], [class*="gradient-mask"]').forEach(el => {
                el.style.maxHeight = 'none';
                el.style.height = 'auto';
                el.style.overflow = 'visible';
                el.style.webkitMaskImage = 'none';
                el.style.maskImage = 'none';
            });

            // Show hidden paragraphs
            document.querySelectorAll('p[style*="display: none"], p.hidden, article[style*="display: none"]').forEach(el => {
                el.style.display = 'block';
            });
        };

        // Create CSS for restriction removal
        const restrictionCSS = `
            /* Re-enable scroll */
            html, body {
                overflow: auto !important;
                overflow-y: auto !important;
                position: static !important;
                height: auto !important;
            }
            
            /* Re-enable text selection */
            * {
                user-select: auto !important;
                -webkit-user-select: auto !important;
                -moz-user-select: auto !important;
            }
            
            /* Remove blur */
            [class*="blur"]:not(.no-deblur),
            [class*="paywall"]:not([class*="button"]),
            [class*="premium-lock"] {
                filter: none !important;
                -webkit-filter: none !important;
            }
            
            /* Remove content fade/truncation */
            [class*="truncate"],
            [class*="fade-out"],
            [class*="content-fade"],
            [class*="gradient-overlay"]:not(nav *) {
                max-height: none !important;
                height: auto !important;
                overflow: visible !important;
                -webkit-mask-image: none !important;
                mask-image: none !important;
            }
            
            /* Hide common overlay walls */
            [class*="adblock-modal"],
            [class*="adblock-overlay"],
            [class*="paywall-overlay"],
            [class*="subscription-modal"],
            [class*="piano-modal"],
            [class*="regwall"],
            .fc-ab-root,
            .fc-dialog-container {
                display: none !important;
                visibility: hidden !important;
            }
        `;

        const restrictionStyle = document.createElement('style');
        restrictionStyle.id = 'privacy-browser-restriction-remover';
        restrictionStyle.textContent = restrictionCSS;
        (document.head || document.documentElement).appendChild(restrictionStyle);

        // Run removal functions
        enableScroll();
        removeBlur();
        enableCopy();
        removeOverlays();
        unhideContent();

        // Re-run periodically for dynamically loaded content
        const interval = setInterval(() => {
            enableScroll();
            removeOverlays();
            removeBlur();
        }, 2000);

        // Stop after 30 seconds
        setTimeout(() => clearInterval(interval), 30000);

        console.log('Privacy Browser: Content restrictions removed');
    }

    // ============================================
    // FEATURE 7: Aggressive DOM Ad Removal
    // ============================================

    function removeAdsFromDOM() {
        if (!settings.blockAds) return;

        // Selectors for elements to remove completely
        const adSelectors = [
            // Shopping/Affiliate widgets
            '[class*="shop-the-story"]',
            '[class*="shopTheStory"]',
            '[class*="storyShop"]',
            '[class*="story-shop"]',
            '[class*="product-carousel"]',
            '[class*="shopping-widget"]',
            '[class*="affiliate"]',
            '[class*="amazon-widget"]',
            '[class*="amzn"]',

            // Sponsored content sections
            '[class*="sponsored"]',
            '[class*="Sponsored"]',
            '[class*="promoted"]',
            '.sponsoredContent',

            // Generic ads
            '.adsbygoogle',
            '[class*="taboola"]',
            '[class*="outbrain"]',
            '[class*="mgid"]',
            '[id*="div-gpt-ad"]',
            '[data-google-query-id]',

            // Site-specific
            '.prime-widget',
            '.toi-video-widget',
            '[class*="primis"]',
            '[class*="connatix"]',

            // Site-specific ad containers (conservative)
            '.RHS_ads',
            '.rhs_ad',
            '.prime-widget',
            '.toi-video-widget',
            
            // Floating video players
            '[class*="sticky-player"]',
            '[class*="stickyPlayer"]',
            '[class*="floating-player"]',
            '[class*="floatingPlayer"]',
            '[class*="pip-player"]',
            '[class*="mini-player"]',
            '[class*="miniPlayer"]',
            '[class*="corner-video"]',
            '[class*="video-float"]',
            '[class*="persist-video"]',
            '[class*="detached-video"]',
            '[class*="docked-video"]',
            '[class*="minimized-video"]'
        ];

        let removedCount = 0;

        adSelectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    // Don't remove navigation or header elements
                    if (el.closest('nav, header, footer:not([class*="ad"])')) return;

                    el.remove();
                    removedCount++;
                });
            } catch (e) { }
        });

        // Also find elements by text content
        findAndRemoveByText();

        if (removedCount > 0) {
            console.log('Privacy Browser: Removed', removedCount, 'ad elements');
        }
        
        // Also remove floating video players by position
        removeFloatingVideos();
    }
    
    function removeFloatingVideos() {
        // Only target SMALL fixed-position video players (floating/pip style)
        // Don't remove main content videos
        document.querySelectorAll('div, section, aside').forEach(el => {
            try {
                const style = window.getComputedStyle(el);
                
                // ONLY target fixed position (not absolute - main videos can be absolute)
                if (style.position !== 'fixed') return;
                
                const rect = el.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                
                // Only target SMALL elements (floating videos are typically small)
                // Main videos are usually larger than 450px wide
                const isSmall = rect.width < 450 && rect.height < 350;
                if (!isSmall) return;
                
                // Check if element is in corners (floating videos appear in corners)
                const isBottomRight = rect.right > windowWidth - 50 && rect.bottom > windowHeight - 50;
                const isBottomLeft = rect.left < 50 && rect.bottom > windowHeight - 50;
                const isInCorner = isBottomRight || isBottomLeft;
                
                if (!isInCorner) return;
                
                // Must have video/iframe AND look like a floating player
                const hasVideo = el.querySelector('video, iframe');
                const className = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
                const hasFloatingClass = className.includes('sticky') || 
                                         className.includes('float') || 
                                         className.includes('pip') ||
                                         className.includes('mini') ||
                                         className.includes('corner') ||
                                         className.includes('detach');
                
                // Only remove if it has video AND looks like floating player
                if (hasVideo && hasFloatingClass) {
                    el.style.display = 'none';
                    el.remove();
                    console.log('Privacy Browser: Removed floating video player');
                }
            } catch (e) {}
        });
    }

    function findAndRemoveByText() {
        // Find containers with clear ad text only
        const textPatterns = [
            'Sponsored',
            'Shop The Story',
            'Shop the Story',
            'Advertisement',
            'Promoted'
        ];

        textPatterns.forEach(pattern => {
            // Find elements containing this text
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        return node.textContent.includes(pattern)
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_REJECT;
                    }
                }
            );

            const nodesToRemove = [];
            while (walker.nextNode()) {
                // Find the parent container (usually 2-4 levels up)
                let el = walker.currentNode.parentElement;
                for (let i = 0; i < 5 && el; i++) {
                    // Check if this looks like an ad container
                    const tagName = el.tagName.toLowerCase();
                    if ((tagName === 'div' || tagName === 'section' || tagName === 'aside') &&
                        !el.closest('nav, header, article > p, .article-body > p')) {

                        // Check size - ad containers are usually large blocks
                        const rect = el.getBoundingClientRect();
                        if (rect.height > 100 && rect.width > 200) {
                            nodesToRemove.push(el);
                            break;
                        }
                    }
                    el = el.parentElement;
                }
            }

            // Remove found containers
            nodesToRemove.forEach(node => {
                try {
                    node.style.display = 'none';
                    node.remove();
                } catch (e) { }
            });
        });
    }

    // ============================================
    // Initialization
    // ============================================

    function init() {
        // Inject anti-adblock bypass FIRST (before page scripts load)
        bypassAdblockDetection();

        // Inject ad-hiding CSS
        injectHideCSS();

        // Run on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onDOMReady);
        } else {
            onDOMReady();
        }
    }

    function onDOMReady() {
        // Cookie consent handling
        setTimeout(handleCookieConsent, 500);
        setTimeout(handleCookieConsent, 2000);
        setTimeout(handleCookieConsent, 5000);

        // Form field scanning
        setTimeout(scanFormFields, 1000);

        // Script analysis
        setTimeout(analyzeScripts, 1500);

        // Content restriction removal (paywall bypass, scroll unlock, etc.)
        setTimeout(removeContentRestrictions, 500);

        // Aggressive DOM ad removal at multiple intervals
        // (catches dynamically loaded ads)
        setTimeout(removeAdsFromDOM, 100);
        setTimeout(removeAdsFromDOM, 1000);
        setTimeout(removeAdsFromDOM, 3000);
        setTimeout(removeAdsFromDOM, 5000);
        setTimeout(removeAdsFromDOM, 10000);
        
        // Extra checks for floating videos (they often load late)
        setTimeout(removeFloatingVideos, 2000);
        setTimeout(removeFloatingVideos, 7000);
        setTimeout(removeFloatingVideos, 15000);
        setTimeout(removeFloatingVideos, 30000);

        // Observe for dynamic content
        observeDOM();
    }

    function observeDOM() {
        let adRemovalScheduled = false;

        const observer = new MutationObserver((mutations) => {
            let hasCookieBanner = false;
            let hasNewInputs = false;
            let hasNewContent = false;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const el = node;

                        // Check for cookie banners
                        if (el.className && typeof el.className === 'string') {
                            const className = el.className.toLowerCase();
                            if (className.includes('cookie') ||
                                className.includes('consent') ||
                                className.includes('gdpr')) {
                                hasCookieBanner = true;
                            }

                            // Check for ad-related content
                            if (className.includes('ad') ||
                                className.includes('sponsor') ||
                                className.includes('promo') ||
                                className.includes('shop') ||
                                className.includes('affiliate') ||
                                className.includes('taboola') ||
                                className.includes('outbrain')) {
                                hasNewContent = true;
                            }
                        }

                        // Check for new form inputs
                        if (el.tagName === 'INPUT' || el.querySelector?.('input')) {
                            hasNewInputs = true;
                        }

                        // Check for ads by content
                        if (el.textContent && (
                            el.textContent.includes('Sponsored') ||
                            el.textContent.includes('Shop The Story') ||
                            el.textContent.includes('Advertisement'))) {
                            hasNewContent = true;
                        }
                    }
                }
            }

            if (hasCookieBanner) {
                setTimeout(handleCookieConsent, 100);
            }

            if (hasNewInputs) {
                setTimeout(scanFormFields, 200);
            }

            // Debounce ad removal to avoid excessive calls
            if (hasNewContent && !adRemovalScheduled) {
                adRemovalScheduled = true;
                setTimeout(() => {
                    removeAdsFromDOM();
                    adRemovalScheduled = false;
                }, 300);
            }
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    init();
})();
