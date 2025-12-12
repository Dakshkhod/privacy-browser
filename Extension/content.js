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
    // FEATURE 4: Ad Blocking (existing)
    // ============================================

    const hideCSS = `
        /* Video popup players */
        [class*="video-popup"],
        [class*="video-overlay"],
        [class*="floating-video"],
        [class*="sticky-video"],
        [class*="video-widget"],
        
        /* Common popup containers */
        [class*="popup-container"],
        [class*="modal-ad"],
        [class*="overlay-ad"],
        [class*="interstitial"],
        
        /* Floating/Sticky ads */
        [class*="floating-ad"],
        [class*="sticky-ad"],
        [class*="fixed-ad"],
        
        /* Ad containers */
        [class*="ad-container"],
        [class*="adContainer"],
        [class*="sponsored-content"],
        
        /* Site-specific */
        .prime-widget,
        .toi-video-widget,
        [class*="primis"],
        [data-ad-slot] {
            display: none !important;
            visibility: hidden !important;
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
    // Initialization
    // ============================================

    function init() {
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

        // Observe for dynamic content
        observeDOM();
    }

    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            let hasCookieBanner = false;
            let hasNewInputs = false;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for cookie banners
                        const el = node;
                        if (el.className && typeof el.className === 'string') {
                            if (el.className.toLowerCase().includes('cookie') ||
                                el.className.toLowerCase().includes('consent') ||
                                el.className.toLowerCase().includes('gdpr')) {
                                hasCookieBanner = true;
                            }
                        }

                        // Check for new form inputs
                        if (el.tagName === 'INPUT' || el.querySelector('input')) {
                            hasNewInputs = true;
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
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    init();
})();
