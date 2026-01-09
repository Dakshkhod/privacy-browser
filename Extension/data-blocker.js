/**
 * Privacy Browser - Data Type Blocker
 * 
 * Blocks specific data types based on user preferences.
 * Each blocker is designed to prevent data collection without breaking site functionality.
 */

(function() {
    'use strict';
    
    // Get blocking preferences from storage
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
    
    // Load preferences from storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['dataBlocking'], (result) => {
            if (result.dataBlocking) {
                blockingPrefs = { ...blockingPrefs, ...result.dataBlocking };
                applyBlocking();
            }
        });
        
        // Listen for preference changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (changes.dataBlocking) {
                blockingPrefs = { ...blockingPrefs, ...changes.dataBlocking.newValue };
                applyBlocking();
            }
        });
    }
    
    // ============================================
    // LOCATION DATA BLOCKER
    // Blocks: Geolocation API
    // ============================================
    
    function blockLocation() {
        if (!blockingPrefs.location) return;
        
        // Override Geolocation API
        if (navigator.geolocation) {
            const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
            const originalWatchPosition = navigator.geolocation.watchPosition;
            
            navigator.geolocation.getCurrentPosition = function(success, error, options) {
                console.log('[Privacy Browser] Blocked location request');
                if (error) {
                    error({ code: 1, message: 'Location blocked by Privacy Browser' });
                }
            };
            
            navigator.geolocation.watchPosition = function(success, error, options) {
                console.log('[Privacy Browser] Blocked location watch');
                if (error) {
                    error({ code: 1, message: 'Location blocked by Privacy Browser' });
                }
                return 0;
            };
        }
        
        console.log('[Privacy Browser] Location blocking active');
    }
    
    // ============================================
    // DEVICE INFORMATION BLOCKER
    // Blocks: User agent details, screen info, hardware info
    // ============================================
    
    function blockDeviceInfo() {
        if (!blockingPrefs.device) return;
        
        // Spoof common device fingerprinting vectors
        const spoofedData = {
            hardwareConcurrency: 4,
            deviceMemory: 8,
            platform: 'Win32',
            vendor: 'Google Inc.',
            language: 'en-US',
            languages: ['en-US', 'en']
        };
        
        // Override navigator properties
        try {
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => spoofedData.hardwareConcurrency });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => spoofedData.deviceMemory });
            Object.defineProperty(navigator, 'platform', { get: () => spoofedData.platform });
            Object.defineProperty(navigator, 'vendor', { get: () => spoofedData.vendor });
            Object.defineProperty(navigator, 'language', { get: () => spoofedData.language });
            Object.defineProperty(navigator, 'languages', { get: () => spoofedData.languages });
        } catch (e) {}
        
        // Block battery API
        if (navigator.getBattery) {
            navigator.getBattery = () => Promise.reject('Blocked by Privacy Browser');
        }
        
        // Spoof screen properties
        try {
            Object.defineProperty(screen, 'width', { get: () => 1920 });
            Object.defineProperty(screen, 'height', { get: () => 1080 });
            Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
            Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
            Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
            Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
        } catch (e) {}
        
        console.log('[Privacy Browser] Device info blocking active');
    }
    
    // ============================================
    // USAGE/TRACKING DATA BLOCKER
    // Blocks: Common tracking methods, cookies for tracking
    // ============================================
    
    function blockUsageTracking() {
        if (!blockingPrefs.usage) return;
        
        // Block common tracking functions
        window._gaq = { push: () => {} };
        window.ga = () => {};
        window.gtag = () => {};
        window._paq = { push: () => {} };
        window.fbq = () => {};
        window.mixpanel = { track: () => {}, identify: () => {} };
        window.amplitude = { getInstance: () => ({ logEvent: () => {}, setUserId: () => {} }) };
        
        // Block sendBeacon for tracking
        const originalSendBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function(url, data) {
            const trackingPatterns = ['analytics', 'tracking', 'pixel', 'beacon', 'collect', 'log'];
            if (trackingPatterns.some(p => url.toLowerCase().includes(p))) {
                console.log('[Privacy Browser] Blocked tracking beacon:', url.substring(0, 50));
                return true; // Pretend success
            }
            return originalSendBeacon.call(this, url, data);
        };
        
        // Block tracking pixels
        const originalImage = window.Image;
        window.Image = function() {
            const img = new originalImage();
            const originalSet = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
            Object.defineProperty(img, 'src', {
                set: function(value) {
                    const trackingPatterns = ['pixel', 'tracking', 'analytics', 'beacon', 'collect'];
                    if (trackingPatterns.some(p => value.toLowerCase().includes(p))) {
                        console.log('[Privacy Browser] Blocked tracking pixel');
                        return;
                    }
                    originalSet.call(this, value);
                }
            });
            return img;
        };
        
        console.log('[Privacy Browser] Usage tracking blocking active');
    }
    
    // ============================================
    // CONTACT INFORMATION BLOCKER
    // Blocks: Form autofill for contact fields
    // ============================================
    
    function blockContactInfo() {
        if (!blockingPrefs.contact) return;
        
        // Disable autofill on contact-related inputs
        const contactFields = ['email', 'tel', 'phone', 'address', 'name', 'postal'];
        
        function disableAutofill() {
            contactFields.forEach(field => {
                document.querySelectorAll(`input[type="${field}"], input[name*="${field}"], input[autocomplete*="${field}"]`).forEach(input => {
                    input.setAttribute('autocomplete', 'off');
                    input.setAttribute('data-privacy-blocked', 'contact');
                });
            });
        }
        
        // Run on load and observe for new elements
        disableAutofill();
        
        const observer = new MutationObserver(disableAutofill);
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
        
        console.log('[Privacy Browser] Contact info blocking active');
    }
    
    // ============================================
    // FINANCIAL DATA BLOCKER
    // Blocks: Payment API, warns on financial forms
    // ============================================
    
    function blockFinancialData() {
        if (!blockingPrefs.financial) return;
        
        // Block Payment Request API
        if (window.PaymentRequest) {
            window.PaymentRequest = function() {
                console.log('[Privacy Browser] Blocked Payment Request API');
                throw new Error('Payment API blocked by Privacy Browser');
            };
        }
        
        // Mark financial input fields
        const financialFields = ['card', 'credit', 'cvv', 'cvc', 'expir', 'payment', 'bank', 'account'];
        
        function markFinancialFields() {
            financialFields.forEach(field => {
                document.querySelectorAll(`input[name*="${field}"], input[id*="${field}"], input[placeholder*="${field}"]`).forEach(input => {
                    if (!input.dataset.privacyWarned) {
                        input.dataset.privacyWarned = 'true';
                        input.style.outline = '2px solid #ff9800';
                        input.title = '⚠️ Privacy Browser: Financial data field';
                    }
                });
            });
        }
        
        markFinancialFields();
        const observer = new MutationObserver(markFinancialFields);
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
        
        console.log('[Privacy Browser] Financial data blocking active');
    }
    
    // ============================================
    // BIOMETRIC DATA BLOCKER
    // Blocks: WebAuthn, fingerprinting APIs
    // ============================================
    
    function blockBiometricData() {
        if (!blockingPrefs.biometric) return;
        
        // Block WebAuthn
        if (navigator.credentials) {
            const originalCreate = navigator.credentials.create;
            const originalGet = navigator.credentials.get;
            
            navigator.credentials.create = async function(options) {
                if (options?.publicKey) {
                    console.log('[Privacy Browser] Blocked WebAuthn create');
                    throw new Error('Biometric authentication blocked by Privacy Browser');
                }
                return originalCreate.call(this, options);
            };
            
            navigator.credentials.get = async function(options) {
                if (options?.publicKey) {
                    console.log('[Privacy Browser] Blocked WebAuthn get');
                    throw new Error('Biometric authentication blocked by Privacy Browser');
                }
                return originalGet.call(this, options);
            };
        }
        
        console.log('[Privacy Browser] Biometric data blocking active');
    }
    
    // ============================================
    // HEALTH DATA BLOCKER
    // Blocks: Form submissions with health-related data
    // ============================================
    
    function blockHealthData() {
        if (!blockingPrefs.health) return;
        
        const healthFields = ['health', 'medical', 'diagnosis', 'prescription', 'doctor', 'patient', 'symptom', 'condition', 'medication'];
        
        function markHealthFields() {
            healthFields.forEach(field => {
                document.querySelectorAll(`input[name*="${field}"], textarea[name*="${field}"], select[name*="${field}"]`).forEach(el => {
                    if (!el.dataset.privacyWarned) {
                        el.dataset.privacyWarned = 'true';
                        el.style.outline = '2px solid #f44336';
                        el.title = '⚠️ Privacy Browser: Health data field - be cautious';
                    }
                });
            });
        }
        
        markHealthFields();
        const observer = new MutationObserver(markHealthFields);
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
        
        console.log('[Privacy Browser] Health data blocking active');
    }
    
    // ============================================
    // SOCIAL DATA BLOCKER
    // Blocks: Social login buttons, sharing widgets
    // ============================================
    
    function blockSocialData() {
        if (!blockingPrefs.social) return;
        
        // CSS to hide social login/sharing buttons
        const style = document.createElement('style');
        style.id = 'privacy-browser-social-block';
        style.textContent = `
            /* Social login buttons */
            [class*="facebook-login"],
            [class*="google-login"],
            [class*="twitter-login"],
            [class*="social-login"],
            [class*="oauth"],
            [id*="facebook-login"],
            [id*="google-login"],
            [data-provider="facebook"],
            [data-provider="google"],
            [data-provider="twitter"],
            
            /* Social sharing widgets */
            .fb-share-button,
            .twitter-share-button,
            .fb-like,
            [class*="social-share"],
            [class*="share-button"],
            .addthis_toolbox,
            .shareaholic-share-buttons {
                opacity: 0.3 !important;
                pointer-events: none !important;
                position: relative !important;
            }
            
            [class*="facebook-login"]::after,
            [class*="google-login"]::after,
            [class*="social-login"]::after {
                content: "🔒 Blocked" !important;
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                background: rgba(0,0,0,0.8) !important;
                color: white !important;
                padding: 2px 8px !important;
                border-radius: 4px !important;
                font-size: 10px !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);
        
        // Block social SDK loading
        window.FB = { init: () => {}, login: () => {}, api: () => {} };
        window.gapi = { load: () => {}, auth2: { init: () => {} } };
        window.twttr = { widgets: { load: () => {} } };
        
        console.log('[Privacy Browser] Social data blocking active');
    }
    
    // ============================================
    // BEHAVIORAL/PROFILING BLOCKER
    // Blocks: Canvas fingerprinting, WebGL fingerprinting
    // ============================================
    
    function blockBehavioralData() {
        if (!blockingPrefs.behavioral) return;
        
        // Block canvas fingerprinting
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
            // Add noise to prevent fingerprinting
            const ctx = this.getContext('2d');
            if (ctx) {
                const imageData = originalGetImageData.call(ctx, 0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = imageData.data[i] ^ (Math.random() * 2);
                }
                ctx.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, args);
        };
        
        // Block WebGL fingerprinting
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
            // Spoof renderer and vendor
            if (param === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
            if (param === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
            return originalGetParameter.call(this, param);
        };
        
        // Block AudioContext fingerprinting
        if (window.AudioContext || window.webkitAudioContext) {
            const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
            window.AudioContext = window.webkitAudioContext = function(...args) {
                const ctx = new OriginalAudioContext(...args);
                const originalCreateOscillator = ctx.createOscillator.bind(ctx);
                ctx.createOscillator = function() {
                    const osc = originalCreateOscillator();
                    // Add slight frequency variation
                    const originalFrequency = osc.frequency;
                    Object.defineProperty(osc, 'frequency', {
                        get: () => ({ ...originalFrequency, value: originalFrequency.value + Math.random() * 0.0001 })
                    });
                    return osc;
                };
                return ctx;
            };
        }
        
        // Block mouse movement tracking
        let lastMouseEvent = 0;
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastMouseEvent < 100) {
                e.stopPropagation();
            }
            lastMouseEvent = now;
        }, true);
        
        // Block keyboard timing analysis
        let lastKeyEvent = 0;
        document.addEventListener('keydown', (e) => {
            const now = Date.now();
            if (now - lastKeyEvent < 50) {
                // Introduce timing noise
                e.timeStamp = e.timeStamp + Math.random() * 10;
            }
            lastKeyEvent = now;
        }, true);
        
        console.log('[Privacy Browser] Behavioral profiling blocking active');
    }
    
    // ============================================
    // APPLY ALL BLOCKING
    // ============================================
    
    function applyBlocking() {
        console.log('[Privacy Browser] Applying data blocking preferences:', blockingPrefs);
        
        if (blockingPrefs.location) blockLocation();
        if (blockingPrefs.device) blockDeviceInfo();
        if (blockingPrefs.usage) blockUsageTracking();
        if (blockingPrefs.contact) blockContactInfo();
        if (blockingPrefs.financial) blockFinancialData();
        if (blockingPrefs.biometric) blockBiometricData();
        if (blockingPrefs.health) blockHealthData();
        if (blockingPrefs.social) blockSocialData();
        if (blockingPrefs.behavioral) blockBehavioralData();
    }
    
    // Initial application
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyBlocking);
    } else {
        applyBlocking();
    }
    
    // Expose for debugging
    window.__privacyBrowserBlocking = blockingPrefs;
})();
