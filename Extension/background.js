// Privacy Browser - Background Service Worker
// Handles extension icon click, tracker blocking, and GPC/DNT signals

// ============================================
// State Management
// ============================================
let blockingStats = {
    totalBlocked: 0,
    blockedByCategory: {
        analytics: 0,
        advertising: 0,
        social: 0,
        marketing: 0,
        fingerprinting: 0
    },
    blockedDomains: {},
    sessionStart: Date.now()
};

// Tracker domain to category mapping (loaded from data file)
let trackerCategories = {};

// ============================================
// Initialization
// ============================================
async function initialize() {
    console.log('Privacy Browser: Initializing...');

    // Load tracker categories
    await loadTrackerCategories();

    // Load saved stats from storage
    await loadStats();

    // Set up GPC and DNT headers
    await setupPrivacyHeaders();

    // Load blocking enabled state
    const { blockingEnabled = true } = await chrome.storage.local.get('blockingEnabled');
    if (!blockingEnabled) {
        await disableBlocking();
    }

    console.log('Privacy Browser: Initialized successfully');
}

// Load tracker categories from data file
async function loadTrackerCategories() {
    try {
        const response = await fetch(chrome.runtime.getURL('data/tracker_domains.json'));
        const data = await response.json();

        // Build domain to category mapping
        for (const [category, info] of Object.entries(data.categories)) {
            for (const domain of info.domains) {
                trackerCategories[domain] = category;
            }
        }
        console.log('Privacy Browser: Loaded tracker categories');
    } catch (error) {
        console.error('Privacy Browser: Failed to load tracker categories:', error);
    }
}

// Load stats from storage
async function loadStats() {
    try {
        const saved = await chrome.storage.local.get('blockingStats');
        if (saved.blockingStats) {
            blockingStats = { ...blockingStats, ...saved.blockingStats };
            blockingStats.sessionStart = Date.now();
        }
    } catch (error) {
        console.error('Privacy Browser: Failed to load stats:', error);
    }
}

// Save stats to storage
async function saveStats() {
    try {
        await chrome.storage.local.set({ blockingStats });
    } catch (error) {
        console.error('Privacy Browser: Failed to save stats:', error);
    }
}

// ============================================
// GPC & DNT Header Setup
// ============================================
const GPC_DNT_RULE_ID = 9999;

async function setupPrivacyHeaders() {
    try {
        // Add dynamic rule to set GPC and DNT headers on all requests
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [GPC_DNT_RULE_ID],
            addRules: [{
                id: GPC_DNT_RULE_ID,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'Sec-GPC', operation: 'set', value: '1' },
                        { header: 'DNT', operation: 'set', value: '1' }
                    ]
                },
                condition: {
                    urlFilter: '*',
                    resourceTypes: [
                        'main_frame', 'sub_frame', 'stylesheet', 'script',
                        'image', 'font', 'object', 'xmlhttprequest', 'ping',
                        'media', 'websocket', 'other'
                    ]
                }
            }]
        });
        console.log('Privacy Browser: GPC and DNT headers configured');
    } catch (error) {
        console.error('Privacy Browser: Failed to set up privacy headers:', error);
    }
}

// ============================================
// Blocking Control
// ============================================
async function enableBlocking() {
    try {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: ['tracker_rules']
        });
        await chrome.storage.local.set({ blockingEnabled: true });
        console.log('Privacy Browser: Blocking enabled');
    } catch (error) {
        console.error('Privacy Browser: Failed to enable blocking:', error);
    }
}

async function disableBlocking() {
    try {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
            disableRulesetIds: ['tracker_rules']
        });
        await chrome.storage.local.set({ blockingEnabled: false });
        console.log('Privacy Browser: Blocking disabled');
    } catch (error) {
        console.error('Privacy Browser: Failed to disable blocking:', error);
    }
}

// ============================================
// Blocked Request Tracking
// ============================================
// Listen for matched rules (blocked requests)
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
    // Only count static tracker rules, not our GPC/DNT header rule
    if (info.rule.rulesetId === 'tracker_rules') {
        const url = new URL(info.request.url);
        const domain = url.hostname;

        // Update stats
        blockingStats.totalBlocked++;

        // Find category for this domain
        const category = findCategoryForDomain(domain);
        if (category && blockingStats.blockedByCategory[category] !== undefined) {
            blockingStats.blockedByCategory[category]++;
        }

        // Track by domain
        if (!blockingStats.blockedDomains[domain]) {
            blockingStats.blockedDomains[domain] = 0;
        }
        blockingStats.blockedDomains[domain]++;

        // Save periodically (every 10 blocks)
        if (blockingStats.totalBlocked % 10 === 0) {
            saveStats();
        }

        // Notify sidepanel of update
        chrome.runtime.sendMessage({
            type: 'TRACKER_BLOCKED',
            stats: blockingStats
        }).catch(() => {
            // Sidepanel may not be open
        });
    }
});

function findCategoryForDomain(domain) {
    // Check exact match first
    if (trackerCategories[domain]) {
        return trackerCategories[domain];
    }

    // Check if any known tracker is a suffix of this domain
    for (const [knownDomain, category] of Object.entries(trackerCategories)) {
        if (domain.endsWith(knownDomain) || domain.endsWith('.' + knownDomain)) {
            return category;
        }
    }

    return 'analytics'; // Default category
}

// ============================================
// Message Handlers
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_BLOCKING_STATS') {
        sendResponse({ stats: blockingStats });
        return true;
    }

    if (message.type === 'GET_BLOCKING_STATUS') {
        chrome.storage.local.get('blockingEnabled').then(result => {
            sendResponse({ enabled: result.blockingEnabled !== false });
        });
        return true;
    }

    if (message.type === 'TOGGLE_BLOCKING') {
        const enable = message.enabled;
        (enable ? enableBlocking() : disableBlocking()).then(() => {
            sendResponse({ success: true, enabled: enable });
        });
        return true;
    }

    if (message.type === 'RESET_STATS') {
        blockingStats = {
            totalBlocked: 0,
            blockedByCategory: {
                analytics: 0,
                advertising: 0,
                social: 0,
                marketing: 0,
                fingerprinting: 0
            },
            blockedDomains: {},
            sessionStart: Date.now()
        };
        saveStats();
        sendResponse({ success: true, stats: blockingStats });
        return true;
    }

    // Handle cookie rejection notification
    if (message.type === 'COOKIE_REJECTED') {
        // Update cookie rejection stats
        updateCookieStats(message.domain);
        sendResponse({ success: true });
        return true;
    }

    // Handle sensitive form fields detection
    if (message.type === 'SENSITIVE_FIELDS_DETECTED') {
        // Store for popup display
        chrome.storage.session.set({
            sensitiveFields: {
                domain: message.domain,
                isSecure: message.isSecure,
                fields: message.fields,
                timestamp: Date.now()
            }
        }).catch(() => { });
        sendResponse({ success: true });
        return true;
    }

    // Handle third-party script analysis
    if (message.type === 'SCRIPTS_ANALYZED') {
        // Categorize and score scripts
        const analyzedScripts = analyzeThirdPartyScripts(message.scripts);
        chrome.storage.session.set({
            pageScripts: {
                domain: message.domain,
                scripts: analyzedScripts,
                timestamp: Date.now()
            }
        }).catch(() => { });
        sendResponse({ success: true });
        return true;
    }

    // Get page security info for popup
    if (message.type === 'GET_PAGE_SECURITY') {
        Promise.all([
            chrome.storage.session.get('sensitiveFields'),
            chrome.storage.session.get('pageScripts'),
            chrome.storage.local.get('cookieStats')
        ]).then(([fields, scripts, cookies]) => {
            sendResponse({
                sensitiveFields: fields.sensitiveFields || null,
                pageScripts: scripts.pageScripts || null,
                cookieStats: cookies.cookieStats || { rejected: 0, domains: [] }
            });
        });
        return true;
    }

    // Get/Set privacy settings
    if (message.type === 'GET_PRIVACY_SETTINGS') {
        chrome.storage.local.get('privacySettings').then(result => {
            sendResponse({
                settings: result.privacySettings || {
                    autoRejectCookies: true,
                    scanForms: true,
                    blockAds: true
                }
            });
        });
        return true;
    }

    if (message.type === 'SET_PRIVACY_SETTINGS') {
        chrome.storage.local.set({ privacySettings: message.settings }).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }

    return false;
});

// Cookie stats tracking
async function updateCookieStats(domain) {
    try {
        const { cookieStats = { rejected: 0, domains: [] } } = await chrome.storage.local.get('cookieStats');
        cookieStats.rejected++;
        if (!cookieStats.domains.includes(domain)) {
            cookieStats.domains.push(domain);
            // Keep only last 100 domains
            if (cookieStats.domains.length > 100) {
                cookieStats.domains = cookieStats.domains.slice(-100);
            }
        }
        await chrome.storage.local.set({ cookieStats });
    } catch (e) {
        console.error('Error updating cookie stats:', e);
    }
}

// Analyze third-party scripts and assign risk scores
function analyzeThirdPartyScripts(scripts) {
    const riskCategories = {
        analytics: { risk: 'medium', color: '#f59e0b', domains: ['google-analytics', 'googletagmanager', 'analytics', 'segment', 'mixpanel', 'amplitude', 'heap'] },
        advertising: { risk: 'high', color: '#ef4444', domains: ['doubleclick', 'googlesyndication', 'adsrvr', 'criteo', 'taboola', 'outbrain', 'facebook.*ads', 'amazon-adsystem'] },
        social: { risk: 'medium', color: '#8b5cf6', domains: ['facebook', 'twitter', 'linkedin', 'pinterest', 'tiktok'] },
        fingerprinting: { risk: 'critical', color: '#dc2626', domains: ['fingerprintjs', 'fpjs', 'botd'] },
        tracking: { risk: 'high', color: '#f97316', domains: ['scorecardresearch', 'quantserve', 'hotjar', 'fullstory', 'mouseflow', 'clarity'] },
        cdn: { risk: 'low', color: '#22c55e', domains: ['cloudflare', 'jsdelivr', 'unpkg', 'cdnjs', 'googleapis.com/ajax', 'gstatic'] }
    };

    return scripts.map(script => {
        let category = 'unknown';
        let risk = 'unknown';
        let color = '#6b7280';

        for (const [cat, info] of Object.entries(riskCategories)) {
            if (info.domains.some(d => script.domain.includes(d))) {
                category = cat;
                risk = info.risk;
                color = info.color;
                break;
            }
        }

        return { ...script, category, risk, color };
    });
}

// ============================================
// Side Panel Management
// ============================================
// Note: Side panel is opened from popup via chrome.sidePanel.open()
// when user clicks "Analyze Privacy Policy" button

// Listen for tab updates
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        chrome.runtime.sendMessage({
            type: 'TAB_CHANGED',
            url: tab.url,
            title: tab.title
        }).catch(() => { });
    } catch (error) {
        // Tab may not exist
    }
});

// Listen for URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id === tabId) {
            chrome.runtime.sendMessage({
                type: 'URL_CHANGED',
                url: changeInfo.url,
                title: tab.title
            }).catch(() => { });
        }
    }
});

// ============================================
// Extension Lifecycle
// ============================================
// Initialize on install/update
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Privacy Browser: Extension installed/updated', details.reason);
    initialize();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Privacy Browser: Browser started');
    initialize();
});

// Initialize immediately
initialize();
