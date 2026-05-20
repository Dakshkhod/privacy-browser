// Poliscope - Background Service Worker (MV3)
// Handles tracker blocking, stats, GPC/DNT signals, and tab security info.

const BACKEND_ORIGIN = 'privacybrowser-backend.onrender.com';
const STATS_STORAGE_KEY = 'blockingStats';
const GPC_DNT_RULE_ID = 9999;
const POLL_INTERVAL_MS = 4000; // poll matched rules per active tab

// ============================================
// State
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
let trackerCategoriesMap = {};       // domain -> category
let trackerCategoriesSuffix = [];    // [{suffix, category}] for endsWith match
let ruleIdToDomain = {};             // ruleId -> domain (from rules/*.json urlFilter)
let initialized = false;
let pollTimer = null;
let lastSeenRuleIdsPerTab = new Map(); // tabId -> Set<ruleId-requestId> dedupe

// ============================================
// Helpers
// ============================================
function safeStringify(value) {
    try { return JSON.stringify(value); } catch (_) { return ''; }
}

function findCategoryForDomain(domain) {
    if (!domain) return 'analytics';
    if (trackerCategoriesMap[domain]) return trackerCategoriesMap[domain];
    for (const entry of trackerCategoriesSuffix) {
        if (domain === entry.suffix || domain.endsWith('.' + entry.suffix)) {
            return entry.category;
        }
    }
    return 'analytics';
}

// Build ruleId -> domain map by parsing urlFilter values from our DNR rules.
// Domain is what follows the `||` anchor up to the first `/`, `^`, or `?`.
function parseDomainFromUrlFilter(urlFilter) {
    if (!urlFilter || typeof urlFilter !== 'string') return null;
    let f = urlFilter;
    if (f.startsWith('||')) f = f.slice(2);
    const stop = f.search(/[\/\^?]/);
    if (stop >= 0) f = f.slice(0, stop);
    return f.toLowerCase() || null;
}

async function loadRuleIdMap() {
    const sources = ['rules/trackers.json', 'rules/youtube-ads.json'];
    const map = {};
    for (const src of sources) {
        try {
            const response = await fetch(chrome.runtime.getURL(src));
            const rules = await response.json();
            if (!Array.isArray(rules)) continue;
            for (const rule of rules) {
                const id = rule && rule.id;
                const filter = rule && rule.condition && rule.condition.urlFilter;
                const domain = parseDomainFromUrlFilter(filter);
                if (id && domain) map[id] = domain;
            }
        } catch (e) {
            console.error('Poliscope: Failed to load', src, e);
        }
    }
    ruleIdToDomain = map;
}

async function loadTrackerCategories() {
    try {
        const response = await fetch(chrome.runtime.getURL('data/tracker_domains.json'));
        const data = await response.json();
        const map = {};
        const suffix = [];
        for (const [category, info] of Object.entries(data.categories || {})) {
            for (const domain of (info.domains || [])) {
                map[domain] = category;
                suffix.push({ suffix: domain, category });
            }
        }
        trackerCategoriesMap = map;
        trackerCategoriesSuffix = suffix;
    } catch (error) {
        console.error('Poliscope: Failed to load tracker categories:', error);
    }
}

async function loadStats() {
    try {
        const saved = await chrome.storage.local.get(STATS_STORAGE_KEY);
        if (saved[STATS_STORAGE_KEY]) {
            blockingStats = {
                ...blockingStats,
                ...saved[STATS_STORAGE_KEY]
            };
        }
        blockingStats.sessionStart = Date.now();
    } catch (error) {
        console.error('Poliscope: Failed to load stats:', error);
    }
}

let saveTimer = null;
function saveStatsDeferred() {
    if (saveTimer) return;
    saveTimer = setTimeout(async () => {
        saveTimer = null;
        try {
            await chrome.storage.local.set({ [STATS_STORAGE_KEY]: blockingStats });
        } catch (e) {
            console.error('Poliscope: Failed to save stats:', e);
        }
    }, 250);
}

// ============================================
// GPC & DNT header injection (production-friendly priority and scope)
// ============================================
async function setupPrivacyHeaders() {
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [GPC_DNT_RULE_ID],
            addRules: [{
                id: GPC_DNT_RULE_ID,
                priority: 100,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'Sec-GPC', operation: 'set', value: '1' },
                        { header: 'DNT', operation: 'set', value: '1' }
                    ]
                },
                condition: {
                    resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'],
                    excludedRequestDomains: [BACKEND_ORIGIN]
                }
            }]
        });
    } catch (error) {
        console.error('Poliscope: Failed to set up privacy headers:', error);
    }
}

// ============================================
// Blocking ruleset toggles
// ============================================
async function enableBlocking() {
    try {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: ['tracker_rules']
        });
        await chrome.storage.local.set({ blockingEnabled: true });
    } catch (e) {
        console.error('Poliscope: Failed to enable blocking:', e);
    }
}

async function disableBlocking() {
    try {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
            disableRulesetIds: ['tracker_rules']
        });
        await chrome.storage.local.set({ blockingEnabled: false });
    } catch (e) {
        console.error('Poliscope: Failed to disable blocking:', e);
    }
}

// ============================================
// Production-safe blocked-request counting via getMatchedRules.
// onRuleMatchedDebug only fires for unpacked extensions; getMatchedRules works
// in published extensions without declarativeNetRequestFeedback permission for
// our own rulesets.
// ============================================
async function pollMatchedRules() {
    let tabs;
    try {
        tabs = await chrome.tabs.query({ active: true });
    } catch (_) { tabs = []; }

    let changed = false;

    for (const tab of tabs) {
        if (!tab || !tab.id || tab.id < 0) continue;
        try {
            const result = await chrome.declarativeNetRequest.getMatchedRules({ tabId: tab.id });
            const rules = result?.rulesMatchedInfo || [];
            if (!rules.length) continue;

            let seen = lastSeenRuleIdsPerTab.get(tab.id);
            if (!seen) {
                seen = new Set();
                lastSeenRuleIdsPerTab.set(tab.id, seen);
            }

            for (const rm of rules) {
                if (!rm || !rm.rule) continue;
                if (rm.rule.rulesetId !== 'tracker_rules' && rm.rule.rulesetId !== 'youtube_ad_rules') continue;
                // dedupe key: ruleId + timeStamp (timeStamp is unique per match)
                const key = rm.rule.ruleId + ':' + rm.timeStamp;
                if (seen.has(key)) continue;
                seen.add(key);

                blockingStats.totalBlocked++;
                changed = true;

                // Map ruleId -> domain (built from rules/*.json urlFilter at init).
                const domain = ruleIdToDomain[rm.rule.ruleId];
                if (domain) {
                    blockingStats.blockedDomains[domain] =
                        (blockingStats.blockedDomains[domain] || 0) + 1;
                    const category = findCategoryForDomain(domain);
                    if (blockingStats.blockedByCategory[category] != null) {
                        blockingStats.blockedByCategory[category]++;
                    } else {
                        blockingStats.blockedByCategory.advertising++;
                    }
                } else if (rm.rule.rulesetId === 'youtube_ad_rules') {
                    blockingStats.blockedByCategory.advertising++;
                }
            }

            // Cap memory: trim seen set if it grows beyond 5000 entries.
            if (seen.size > 5000) {
                const arr = Array.from(seen).slice(-2500);
                lastSeenRuleIdsPerTab.set(tab.id, new Set(arr));
            }
        } catch (_) {
            // tab might be closed or restricted; ignore
        }
    }

    if (changed) {
        saveStatsDeferred();
        try {
            await chrome.runtime.sendMessage({ type: 'TRACKER_BLOCKED', stats: blockingStats });
        } catch (_) {}
    }
}

function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(pollMatchedRules, POLL_INTERVAL_MS);
}

// Clean dedupe maps when tabs close.
chrome.tabs.onRemoved.addListener((tabId) => {
    lastSeenRuleIdsPerTab.delete(tabId);
});

// ============================================
// Third-party script analyzer
// ============================================
const riskCategories = {
    analytics:      { risk: 'medium',   color: '#f59e0b', domains: ['google-analytics', 'googletagmanager', 'analytics', 'segment', 'mixpanel', 'amplitude', 'heap'] },
    advertising:    { risk: 'high',     color: '#ef4444', domains: ['doubleclick', 'googlesyndication', 'adsrvr', 'criteo', 'taboola', 'outbrain', 'amazon-adsystem'] },
    social:         { risk: 'medium',   color: '#8b5cf6', domains: ['facebook', 'twitter', 'linkedin', 'pinterest', 'tiktok'] },
    fingerprinting: { risk: 'critical', color: '#dc2626', domains: ['fingerprintjs', 'fpjs', 'botd'] },
    tracking:       { risk: 'high',     color: '#f97316', domains: ['scorecardresearch', 'quantserve', 'hotjar', 'fullstory', 'mouseflow', 'clarity'] },
    cdn:            { risk: 'low',      color: '#22c55e', domains: ['cloudflare', 'jsdelivr', 'unpkg', 'cdnjs', 'gstatic'] }
};

function analyzeThirdPartyScripts(scripts) {
    const out = [];
    for (const script of (scripts || [])) {
        const domain = (script?.domain || '').toLowerCase();
        let category = 'unknown';
        let risk = 'unknown';
        let color = '#6b7280';
        for (const [cat, info] of Object.entries(riskCategories)) {
            if (info.domains.some(d => domain.includes(d))) {
                category = cat;
                risk = info.risk;
                color = info.color;
                break;
            }
        }
        out.push({ domain: script?.domain || '', url: script?.url || '', category, risk, color });
    }
    return out;
}

// ============================================
// Cookie stats
// ============================================
async function updateCookieStats(domain) {
    try {
        const { cookieStats = { rejected: 0, domains: [] } } = await chrome.storage.local.get('cookieStats');
        cookieStats.rejected = (cookieStats.rejected || 0) + 1;
        if (domain && !cookieStats.domains.includes(domain)) {
            cookieStats.domains.push(domain);
            if (cookieStats.domains.length > 100) {
                cookieStats.domains = cookieStats.domains.slice(-100);
            }
        }
        await chrome.storage.local.set({ cookieStats });
    } catch (e) {
        console.error('Poliscope: Error updating cookie stats:', e);
    }
}

// ============================================
// Message handlers
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    switch (message.type) {
        case 'GET_BLOCKING_STATS':
            sendResponse({ stats: blockingStats });
            return false;

        case 'GET_BLOCKING_STATUS':
            chrome.storage.local.get('blockingEnabled').then(result => {
                sendResponse({ enabled: result.blockingEnabled !== false });
            });
            return true;

        case 'GET_SITE_BLOCKING_LEVEL': {
            const host = (message.hostname || '').toLowerCase();
            chrome.storage.local.get(['siteBlockingLevels', 'defaultBlockingLevel']).then(result => {
                const siteLevels = result.siteBlockingLevels || {};
                const defaultLevel = result.defaultBlockingLevel || 'standard';
                const merchantHosts = ['amazon.', 'aliexpress.', 'flipkart.', 'tatacliq.',
                    'myntra.', 'nykaa.', 'shopsy.', 'meesho.', 'ajio.', 'ebay.',
                    'walmart.', 'snapdeal.', 'firstcry.'];
                let level;
                let source;
                if (siteLevels[host]) {
                    level = siteLevels[host];
                    source = 'user';
                } else if (merchantHosts.some(m => host.includes(m))) {
                    level = 'off';
                    source = 'merchant-default';
                } else {
                    level = defaultLevel;
                    source = 'global-default';
                }
                sendResponse({ hostname: host, level, source });
            });
            return true;
        }

        case 'SET_SITE_BLOCKING_LEVEL': {
            const host = (message.hostname || '').toLowerCase();
            const level = message.level;
            if (!host || !['aggressive', 'standard', 'off'].includes(level)) {
                sendResponse({ success: false, error: 'Invalid hostname or level' });
                return false;
            }
            chrome.storage.local.get('siteBlockingLevels').then(result => {
                const siteLevels = result.siteBlockingLevels || {};
                siteLevels[host] = level;
                return chrome.storage.local.set({ siteBlockingLevels: siteLevels });
            }).then(() => sendResponse({ success: true, hostname: host, level }))
              .catch(err => sendResponse({ success: false, error: String(err) }));
            return true;
        }

        case 'TOGGLE_BLOCKING': {
            const enable = !!message.enabled;
            (enable ? enableBlocking() : disableBlocking()).then(() => {
                sendResponse({ success: true, enabled: enable });
            });
            return true;
        }

        case 'RESET_STATS':
            blockingStats = {
                totalBlocked: 0,
                blockedByCategory: { analytics: 0, advertising: 0, social: 0, marketing: 0, fingerprinting: 0 },
                blockedDomains: {},
                sessionStart: Date.now()
            };
            lastSeenRuleIdsPerTab.clear();
            saveStatsDeferred();
            sendResponse({ success: true, stats: blockingStats });
            return false;

        case 'COOKIE_REJECTED':
            updateCookieStats(message.domain).then(() => sendResponse({ success: true }));
            return true;

        case 'SENSITIVE_FIELDS_DETECTED':
            chrome.storage.session.set({
                sensitiveFields: {
                    domain: message.domain,
                    isSecure: !!message.isSecure,
                    fields: Array.isArray(message.fields) ? message.fields : [],
                    timestamp: Date.now()
                }
            }).then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
            return true;

        case 'SCRIPTS_ANALYZED': {
            const analyzedScripts = analyzeThirdPartyScripts(message.scripts);
            chrome.storage.session.set({
                pageScripts: {
                    domain: message.domain,
                    scripts: analyzedScripts,
                    timestamp: Date.now()
                }
            }).then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
            return true;
        }

        case 'GET_PAGE_SECURITY':
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

        case 'GET_PRIVACY_SETTINGS':
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

        case 'SET_PRIVACY_SETTINGS':
            chrome.storage.local.set({ privacySettings: message.settings || {} })
                .then(() => sendResponse({ success: true }))
                .catch(() => sendResponse({ success: false }));
            return true;

        default:
            return false;
    }
});

// ============================================
// Tab activity / URL changes — broadcast lightweight events; consumers are optional.
// ============================================
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        chrome.runtime.sendMessage({ type: 'TAB_CHANGED', url: tab.url, title: tab.title }).catch(() => {});
    } catch (_) {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id === tabId) {
            chrome.runtime.sendMessage({ type: 'URL_CHANGED', url: changeInfo.url, title: tab.title }).catch(() => {});
        }
    } catch (_) {}
});

// ============================================
// Initialization (single-flight, idempotent)
// ============================================
async function initialize() {
    if (initialized) return;
    initialized = true;
    try {
        await loadTrackerCategories();
        await loadRuleIdMap();
        await loadStats();
        await setupPrivacyHeaders();
        const { blockingEnabled = true } = await chrome.storage.local.get('blockingEnabled');
        if (!blockingEnabled) {
            await disableBlocking();
        }
        startPolling();
    } catch (e) {
        // Allow re-init on next event.
        initialized = false;
        console.error('Poliscope: initialize() failed:', e);
    }
}

chrome.runtime.onInstalled.addListener(() => { initialize(); });
chrome.runtime.onStartup.addListener(() => { initialize(); });
initialize();
