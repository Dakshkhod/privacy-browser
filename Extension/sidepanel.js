// Privacy Browser - Side Panel JavaScript
// Main application logic for Chrome extension

// ============================================
// Configuration
// ============================================
const config = {
    BACKEND_URL: 'https://privacybrowser-backend.onrender.com',
    TIMEOUT: 90000,
    MAX_RETRIES: 2
};
const BACKEND_URL = config.BACKEND_URL;

// HTML-escape utility (XSS-safe template interpolation).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// ============================================
// State Management
// ============================================
let state = {
    url: '',
    loading: false,
    error: null,
    analysis: null,
    analysisType: '',
    progress: 0,
    currentStep: 0,
    chart: null,
    legendTypes: null,
    legendColors: null,
    legendExpanded: false
};

const websiteSteps = [
    "Connecting to website...",
    "Searching for privacy policy...",
    "Extracting policy content...",
    "Analyzing data collection...",
    "Generating insights..."
];
const directSteps = [
    "Connecting to privacy policy...",
    "Fetching policy content...",
    "Analyzing data collection...",
    "Generating insights..."
];
const chartColors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
    "#06b6d4", "#84cc16", "#f97316", "#ef4444", "#6b7280"
];

// ============================================
// DOM Elements
// ============================================
const elements = {
    urlInput: document.getElementById('urlInput'),
    urlForm: document.getElementById('urlForm'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    clearBtn: document.getElementById('clearBtn'),
    currentDomain: document.getElementById('currentDomain'),
    urlTypeText: document.getElementById('urlTypeText'),
    urlTypeIndicator: document.getElementById('urlTypeIndicator'),

    inputSection: document.getElementById('inputSection'),
    loadingSection: document.getElementById('loadingSection'),
    errorSection: document.getElementById('errorSection'),
    resultsSection: document.getElementById('resultsSection'),

    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    stepsList: document.getElementById('stepsList'),

    errorCard: document.getElementById('errorCard'),
    errorIcon: document.getElementById('errorIcon'),
    errorBadge: document.getElementById('errorBadge'),
    errorMessage: document.getElementById('errorMessage'),
    errorReason: document.getElementById('errorReason'),
    backendSuggestions: document.getElementById('backendSuggestions'),
    suggestionList: document.getElementById('suggestionList'),
    urlSuggestions: document.getElementById('urlSuggestions'),
    urlSuggestionButtons: document.getElementById('urlSuggestionButtons'),
    searchGoogleBtn: document.getElementById('searchGoogleBtn'),
    retryBtn: document.getElementById('retryBtn'),

    riskBadge: document.getElementById('riskBadge'),
    riskSummary: document.getElementById('riskSummary'),
    riskCard: document.getElementById('riskCard'),
    userSummary: document.getElementById('userSummary'),
    summaryCard: document.getElementById('summaryCard'),
    dataTypesList: document.getElementById('dataTypesList'),
    chartLegend: document.getElementById('chartLegend'),
    darkPatternsCard: document.getElementById('darkPatternsCard'),
    darkPatternsSeverity: document.getElementById('darkPatternsSeverity'),
    darkPatternsCount: document.getElementById('darkPatternsCount'),
    darkPatternsList: document.getElementById('darkPatternsList'),
    warningsCard: document.getElementById('warningsCard'),
    warningsList: document.getElementById('warningsList'),
    rightsCard: document.getElementById('rightsCard'),
    rightsList: document.getElementById('rightsList'),
    alternativesCard: document.getElementById('alternativesCard'),
    alternativesList: document.getElementById('alternativesList'),
    newAnalysisBtn: document.getElementById('newAnalysisBtn'),
    metricsDashboard: document.getElementById('metricsDashboard'),

    dataBlockingCard: document.getElementById('dataBlockingCard'),
    dataBlockingList: document.getElementById('dataBlockingList'),
    blockAllDataBtn: document.getElementById('blockAllDataBtn'),

    footerVersion: document.getElementById('footerVersion')
};

// Set footer version from manifest
try {
    if (elements.footerVersion) {
        elements.footerVersion.textContent = 'v' + chrome.runtime.getManifest().version;
    }
} catch (_) {}

// Setup clickable metric cards
document.querySelectorAll('.clickable-card[data-scroll-to]').forEach(card => {
    card.addEventListener('click', () => {
        const targetId = card.getAttribute('data-scroll-to');
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            targetElement.style.transition = 'box-shadow 0.3s ease';
            targetElement.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.5)';
            setTimeout(() => { targetElement.style.boxShadow = ''; }, 1500);
        }
    });
});

// ============================================
// Utility Functions
// ============================================
function safeString(value) {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        if (value.text) return String(value.text);
        if (value.right) return String(value.right);
        if (value.practice) return String(value.practice);
        if (value.measure) return String(value.measure);
        if (value.type) return String(value.type);
        if (value.purpose) return String(value.purpose);
        return '';
    }
    return String(value);
}
function safeArray(value) {
    if (Array.isArray(value)) return value;
    return [];
}
function safeObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    return {};
}

// Strip any HTML tags from backend strings (defense in depth) before display.
function stripHtml(s) {
    return String(s ?? '').replace(/<[^>]*>/g, '');
}

// ============================================
// Privacy Policy Change Detection
// ============================================
function generatePolicyHash(analysis) {
    if (!analysis) return null;
    const keyData = [
        analysis.risk_level || '',
        (safeArray(analysis.data_types)).join('|'),
        (safeArray(analysis.warnings)).slice(0, 5).map(w => safeString(w)).join('|'),
        (safeArray(analysis.user_rights)).slice(0, 5).map(r => safeString(r)).join('|')
    ].join('::');
    let hash = 0;
    for (let i = 0; i < keyData.length; i++) {
        const char = keyData.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

async function storePolicyHash(domain, hash, analysis) {
    try {
        const { policyHashes = {} } = await chrome.storage.local.get('policyHashes');
        const previousHash = policyHashes[domain]?.hash;
        const hasChanged = previousHash && previousHash !== hash;
        policyHashes[domain] = {
            hash,
            lastChecked: Date.now(),
            riskLevel: analysis.risk_level,
            previousHash: previousHash || null,
            changeDetected: hasChanged
        };
        const domains = Object.keys(policyHashes);
        if (domains.length > 200) {
            const sorted = domains.sort((a, b) => policyHashes[a].lastChecked - policyHashes[b].lastChecked);
            sorted.slice(0, domains.length - 200).forEach(d => delete policyHashes[d]);
        }
        await chrome.storage.local.set({ policyHashes });
        return { hasChanged, previousHash };
    } catch (error) {
        console.error('Error storing policy hash:', error);
        return { hasChanged: false, previousHash: null };
    }
}

async function checkPolicyChange(domain) {
    try {
        const { policyHashes = {} } = await chrome.storage.local.get('policyHashes');
        return policyHashes[domain] || null;
    } catch (error) {
        console.error('Error checking policy change:', error);
        return null;
    }
}

function showPolicyChangeNotification(domain, previousRisk) {
    if (document.querySelector('.policy-change-notification')) return;
    const notification = document.createElement('div');
    notification.className = 'policy-change-notification';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'change-icon';
    iconDiv.textContent = '🔔';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'change-content';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'change-title';
    titleDiv.textContent = 'Privacy Policy Changed!';
    const textDiv = document.createElement('div');
    textDiv.className = 'change-text';
    textDiv.textContent = `${domain} has updated their privacy policy since your last analysis.`;
    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(textDiv);
    if (previousRisk) {
        const prevDiv = document.createElement('div');
        prevDiv.className = 'change-previous';
        prevDiv.textContent = `Previous risk level: ${previousRisk}`;
        contentDiv.appendChild(prevDiv);
    }

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'change-dismiss';
    dismissBtn.textContent = '×';
    dismissBtn.addEventListener('click', () => notification.remove());

    notification.appendChild(iconDiv);
    notification.appendChild(contentDiv);
    notification.appendChild(dismissBtn);

    if (!document.getElementById('policy-change-styles')) {
        const styles = document.createElement('style');
        styles.id = 'policy-change-styles';
        styles.textContent = `
            .policy-change-notification {
                position: fixed; top: 10px; left: 10px; right: 10px;
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white; padding: 12px; border-radius: 10px;
                display: flex; align-items: flex-start; gap: 10px;
                box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
                z-index: 10000; animation: slideDown 0.3s ease;
            }
            .change-icon { font-size: 1.5rem; }
            .change-content { flex: 1; }
            .change-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 4px; }
            .change-text { font-size: 0.75rem; opacity: 0.9; }
            .change-previous { font-size: 0.7rem; opacity: 0.8; margin-top: 4px; }
            .change-dismiss {
                background: rgba(255,255,255,0.2); border: none; color: white;
                width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 1rem;
            }
            @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(notification);
    setTimeout(() => { if (notification.parentElement) notification.remove(); }, 10000);
}

// ============================================
// Friendly labels / icons / weights / summaries
// ============================================
function getFriendlyLabel(dataType) {
    if (!dataType || typeof dataType !== 'string') return 'Unknown Data Type';
    const friendlyLabels = {
        phone: 'Phone Numbers', browsing: 'Browsing & Device Info',
        id: 'Government/ID Documents', social: 'Social Media Accounts',
        email: 'Email Addresses', location: 'Location Information',
        payment: 'Payment & Financial Info', name: 'Name/Username',
        age: 'Age/Birthdate', biometric: 'Biometric Data',
        health: 'Health/Medical Info', education: 'Education Details',
        employment: 'Employment Details', behavior: 'Preferences & Interests',
        content: 'Photos & Videos', communication: 'Messages & Chats',
        device: 'Device Information', demographic: 'Demographic Data',
        advertising: 'Advertising Data', usage: 'Usage Patterns',
        network: 'Network Information', camera: 'Camera Access',
        microphone: 'Microphone Access', calendar: 'Calendar Data',
        contacts: 'Contact List', files: 'Files & Documents',
        app_usage: 'App Usage Data', purchase: 'Purchase History',
        search: 'Search History', profile: 'Profile Information',
        account: 'Account Data', login: 'Login Information',
        activity: 'Activity Data', preferences: 'User Preferences',
        interests: 'Interests & Hobbies', relationships: 'Relationship Data',
        political: 'Political Views', religious: 'Religious Beliefs',
        sexual_orientation: 'Sexual Orientation', ethnicity: 'Ethnicity & Race',
        gender: 'Gender Identity', income: 'Income & Financial Status',
        family: 'Family Information', travel: 'Travel Data',
        shopping: 'Shopping Behavior', entertainment: 'Entertainment Preferences',
        news: 'News Preferences', sports: 'Sports Data',
        music: 'Music Preferences', gaming: 'Gaming Data',
        search_history: 'Search History', location_history: 'Location History',
        browsing_history: 'Browsing History', voice_data: 'Voice Data',
        social_graph: 'Social Graph', content_analysis: 'Content Analysis',
        behavioral_targeting: 'Behavioral Targeting',
        cross_platform_tracking: 'Cross-Platform Tracking',
        purchase_history: 'Purchase History', shopping_behavior: 'Shopping Behavior',
        product_preferences: 'Product Preferences', voice_commands: 'Voice Commands'
    };
    return friendlyLabels[dataType] || dataType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getDataTypeIcon(dataType) {
    if (!dataType || typeof dataType !== 'string') return '📄';
    const icons = {
        email: '📧', phone: '📱', name: '👤', age: '🎂', id: '🆔',
        location: '📍', browsing: '🌐', network: '🌍', payment: '💳',
        biometric: '🫵', health: '🏥', social: '👥', communication: '💬',
        content: '📸', relationships: '💕', device: '📱', camera: '📷',
        microphone: '🎤', files: '📁', behavior: '🧠', activity: '📊',
        usage: '📈', app_usage: '📱', preferences: '⚙️', interests: '🎯',
        search: '🔍', demographic: '📊', advertising: '📢', profile: '👤',
        account: '🔐', political: '🗳️', religious: '⛪',
        sexual_orientation: '🏳️‍🌈', ethnicity: '🌍', gender: '⚧',
        income: '💰', family: '👨‍👩‍👧‍👦', travel: '✈️', shopping: '🛒',
        entertainment: '🎬', news: '📰', sports: '⚽', music: '🎵',
        gaming: '🎮', calendar: '📅', contacts: '📞', purchase: '🛍️',
        login: '🔑', education: '🎓', employment: '💼',
        search_history: '🔍', location_history: '📍', browsing_history: '🌐',
        voice_data: '🎤', social_graph: '👥', content_analysis: '📊',
        behavioral_targeting: '🎯', cross_platform_tracking: '🔄',
        purchase_history: '🛒', shopping_behavior: '🛍️',
        product_preferences: '⭐', voice_commands: '🎙️'
    };
    return icons[dataType] || '📄';
}

function getDataTypeWeight(dataType) {
    if (!dataType || typeof dataType !== 'string') return 1;
    const weights = {
        biometric: 15, political: 14, religious: 14, sexual_orientation: 14,
        health: 13, id: 12, payment: 11,
        location: 10, browsing: 9, advertising: 9, demographic: 9,
        communication: 8, content: 8, social: 8, behavior: 8,
        device: 7, camera: 7, microphone: 7, contacts: 7,
        calendar: 6, files: 6, app_usage: 6, purchase: 6,
        search: 6, profile: 6, account: 6, activity: 6,
        phone: 5, email: 4, name: 3, age: 3,
        preferences: 4, interests: 4, relationships: 5,
        ethnicity: 6, gender: 5, income: 8, family: 7,
        usage: 3, network: 3, login: 3, travel: 4, shopping: 4,
        entertainment: 3, news: 3, sports: 3, music: 3, gaming: 3,
        education: 4, employment: 5,
        search_history: 12, location_history: 11, browsing_history: 10,
        voice_data: 13, social_graph: 12, content_analysis: 11,
        behavioral_targeting: 14, cross_platform_tracking: 13,
        purchase_history: 9, shopping_behavior: 8, product_preferences: 7,
        voice_commands: 12
    };
    return weights[dataType] || 1;
}

function getDataTypeSummary(dataType) {
    if (!dataType || typeof dataType !== 'string') return 'General data collection';
    const summaries = {
        email: 'For communication and notifications',
        phone: 'For verification and support',
        location: 'Location-based services',
        payment: 'Transaction processing',
        browsing: 'Usage analytics',
        name: 'Account personalization',
        age: 'Age verification',
        id: 'Identity verification',
        biometric: 'Advanced security',
        social: 'Social features',
        health: 'Health services',
        education: 'Educational services',
        employment: 'Professional features',
        behavior: 'Personalized recommendations',
        device: 'Device compatibility',
        camera: 'Photo/video features',
        microphone: 'Voice features',
        contacts: 'Contact syncing',
        calendar: 'Scheduling features',
        files: 'File storage/sharing',
        search: 'Search improvements',
        advertising: 'Targeted advertising',
        demographic: 'Service customization',
        activity: 'Activity tracking'
    };
    return summaries[dataType] || 'Service improvement';
}

function normalizeUrl(input) {
    if (!input || !input.trim()) return null;
    let normalized = input.trim();
    normalized = normalized.replace(/^(https?:\/\/)+/i, 'https://');
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = 'https://' + normalized;
    }
    try {
        new URL(normalized);
        return normalized;
    } catch {
        return null;
    }
}

function detectUrlType(inputUrl) {
    if (!inputUrl || !inputUrl.trim()) return null;
    const url = inputUrl.toLowerCase().trim();
    const privacyIndicators = [
        'privacy', 'policy', 'data-protection', 'gdpr', 'ccpa',
        'cookie-policy', 'legal/privacy', 'terms-privacy'
    ];
    const hasPrivacyIndicator = privacyIndicators.some(indicator => url.includes(indicator));
    return hasPrivacyIndicator ? 'direct' : 'website';
}

function getErrorCategory(code) {
    const categories = {
        BOT_PROTECTION: { icon: '🛡️', label: 'Bot Protection', severity: 'warning' },
        JAVASCRIPT_REQUIRED: { icon: '📜', label: 'JavaScript Required', severity: 'info' },
        CAPTCHA_REQUIRED: { icon: '🤖', label: 'CAPTCHA Required', severity: 'warning' },
        ACCESS_DENIED: { icon: '⛔', label: 'Access Denied', severity: 'error' },
        TIMEOUT: { icon: '⏱️', label: 'Timeout', severity: 'warning' },
        CONNECTION_FAILED: { icon: '🔌', label: 'Connection Failed', severity: 'error' },
        SSL_ERROR: { icon: '🔒', label: 'SSL Error', severity: 'error' },
        SERVER_ERROR: { icon: '🔧', label: 'Server Error', severity: 'error' },
        RATE_LIMITED: { icon: '⏳', label: 'Rate Limited', severity: 'warning' },
        LOGIN_REQUIRED: { icon: '🔐', label: 'Login Required', severity: 'info' },
        GEO_BLOCKED: { icon: '🌍', label: 'Geo-Blocked', severity: 'warning' },
        NOT_FOUND: { icon: '🔍', label: 'Not Found', severity: 'info' },
        PAGE_NOT_FOUND: { icon: '🔍', label: 'Page Not Found', severity: 'info' },
        NETWORK_ERROR: { icon: '📡', label: 'Network Error', severity: 'error' }
    };
    return categories[code] || { icon: '❓', label: code || 'Unknown Error', severity: 'error' };
}

// ============================================
// UI Functions
// ============================================
function showSection(sectionId) {
    ['inputSection', 'loadingSection', 'errorSection', 'resultsSection'].forEach(id => {
        const section = document.getElementById(id);
        if (section) section.classList.toggle('hidden', id !== sectionId);
    });
}

function updateProgress(percent) {
    if (!elements.progressFill || !elements.progressText) return;
    elements.progressFill.style.width = percent + '%';
    elements.progressText.textContent = Math.round(percent) + '%';
}

function renderLoadingSteps(steps, currentStep) {
    if (!elements.stepsList) return;
    elements.stepsList.innerHTML = steps.map((step, index) => {
        let statusClass = '';
        let statusIcon = '○';
        if (index < currentStep) { statusClass = 'completed'; statusIcon = '✓'; }
        else if (index === currentStep) { statusClass = 'active'; statusIcon = '●'; }
        return `
            <div class="step ${esc(statusClass)}">
                <span class="step-icon">${esc(statusIcon)}</span>
                <span class="step-text">${esc(step)}</span>
            </div>
        `;
    }).join('');
}

function renderError(error) {
    const errorMessage = typeof error === 'object' ? error.message : error;
    const errorCode = typeof error === 'object' ? error.code : null;
    const errorReason = typeof error === 'object' ? error.reason : null;
    const backendSuggestions = typeof error === 'object' ? (error.suggestions || []) : [];

    const category = getErrorCategory(errorCode);

    if (elements.errorIcon) elements.errorIcon.textContent = category.icon;
    if (elements.errorBadge) {
        elements.errorBadge.textContent = category.label;
        elements.errorBadge.className = 'error-code-badge severity-' + esc(category.severity);
    }
    if (elements.errorCard) elements.errorCard.className = 'error-card error-' + esc(category.severity);
    if (elements.errorMessage) elements.errorMessage.textContent = errorMessage || 'Unknown error';

    if (errorReason && elements.errorReason) {
        elements.errorReason.textContent = 'Technical details: ' + stripHtml(errorReason);
        elements.errorReason.classList.remove('hidden');
    } else if (elements.errorReason) {
        elements.errorReason.classList.add('hidden');
    }

    if (backendSuggestions.length > 0 && elements.suggestionList && elements.backendSuggestions) {
        elements.suggestionList.innerHTML = backendSuggestions
            .map(s => `<li>${esc(stripHtml(s))}</li>`).join('');
        elements.backendSuggestions.classList.remove('hidden');
    } else if (elements.backendSuggestions) {
        elements.backendSuggestions.classList.add('hidden');
    }

    if (errorCode && ['NOT_FOUND', 'PAGE_NOT_FOUND', 'JAVASCRIPT_REQUIRED', 'BOT_PROTECTION'].includes(errorCode)) {
        const urlSuggestions = getSmartUrlSuggestions(state.url);
        if (urlSuggestions.length > 0 && elements.urlSuggestions && elements.urlSuggestionButtons) {
            elements.urlSuggestionButtons.innerHTML = urlSuggestions.slice(0, 4).map(s =>
                `<button class="suggestion-btn" data-url="${esc(s.url)}">🔗 ${esc(s.label)}</button>`
            ).join('');
            elements.urlSuggestions.classList.remove('hidden');
            elements.urlSuggestionButtons.querySelectorAll('.suggestion-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const url = btn.dataset.url;
                    if (elements.urlInput) elements.urlInput.value = url;
                    state.url = url;
                    updateUrlTypeIndicator();
                    showSection('inputSection');
                });
            });
        } else if (elements.urlSuggestions) {
            elements.urlSuggestions.classList.add('hidden');
        }
    } else if (elements.urlSuggestions) {
        elements.urlSuggestions.classList.add('hidden');
    }

    showSection('errorSection');
}

function getSmartUrlSuggestions(inputUrl) {
    if (!inputUrl) return [];
    try {
        const urlObj = new URL(inputUrl.startsWith('http') ? inputUrl : 'https://' + inputUrl);
        const domain = urlObj.hostname;
        const suggestions = [];
        ['/privacy', '/privacy-policy', '/legal/privacy'].forEach(path => {
            suggestions.push({ url: 'https://' + domain + path, label: domain + path });
        });
        if (domain.includes('whatsapp')) {
            suggestions.unshift({ url: 'https://www.whatsapp.com/legal/privacy-policy', label: 'WhatsApp Privacy Policy' });
        } else if (domain.includes('facebook')) {
            suggestions.unshift({ url: 'https://www.facebook.com/privacy/policy/', label: 'Facebook Privacy Policy' });
        } else if (domain.includes('google')) {
            suggestions.unshift({ url: 'https://policies.google.com/privacy', label: 'Google Privacy Policy' });
        }
        return suggestions.slice(0, 6);
    } catch {
        return [];
    }
}

function updateUrlTypeIndicator() {
    if (!elements.urlInput || !elements.urlTypeText) return;
    const url = elements.urlInput.value;
    if (!url) {
        elements.urlTypeText.textContent = 'Enter a URL to analyze';
        return;
    }
    const urlType = detectUrlType(url);
    elements.urlTypeText.textContent = urlType === 'direct'
        ? '🔗 Direct privacy policy link detected'
        : '🌐 Website - will search for privacy policy';
}

// ============================================
// Render results (all interpolated strings sanitized)
// ============================================
async function renderResults(analysis) {
    if (!analysis) return;

    const riskLevel = safeString(analysis.risk_level) || 'Unknown';
    const dataTypes = safeObject(analysis.data_types);
    const warnings = safeArray(analysis.warnings);
    const summary_obj = safeObject(analysis.summary);
    const userRights = safeArray(summary_obj.user_rights);
    const riskFactors = safeArray(analysis.risk_factors);

    try {
        const domain = getDomainFromUrl(state.url);
        const hash = generatePolicyHash(analysis);
        if (hash && domain) {
            const { hasChanged } = await storePolicyHash(domain, hash, analysis);
            const previousData = await checkPolicyChange(domain);
            if (hasChanged && previousData) {
                showPolicyChangeNotification(domain, previousData.riskLevel);
            }
        }
    } catch (e) {
        console.error('Error checking policy change:', e);
    }

    const dataTypesCount = Object.keys(dataTypes).filter(type => {
        const value = dataTypes[type];
        if (typeof value === 'object' && value !== null) {
            return value.severity > 0 || (value.details && value.details.length > 0);
        }
        return (value || 0) > 0;
    }).length;

    const riskIcon = document.getElementById('riskIcon');
    const dataTypesCountEl = document.getElementById('dataTypesCount');
    const warningsCountEl = document.getElementById('warningsCount');
    const rightsCountEl = document.getElementById('rightsCount');

    if (riskIcon) riskIcon.textContent = riskLevel === 'Low' ? '🟢' : riskLevel === 'Medium' ? '🟡' : '🔴';
    if (dataTypesCountEl) dataTypesCountEl.textContent = dataTypesCount;
    if (warningsCountEl) warningsCountEl.textContent = warnings.length;
    if (rightsCountEl) rightsCountEl.textContent = userRights.length;

    const riskLevelClass = riskLevel.toLowerCase().replace(/\s+/g, '-');
    if (elements.riskBadge) {
        elements.riskBadge.textContent = riskLevel;
        elements.riskBadge.className = 'risk-level-badge ' + riskLevelClass;
    }
    const riskBadgeLarge = document.getElementById('riskBadgeLarge');
    if (riskBadgeLarge) {
        riskBadgeLarge.textContent = riskLevel;
        riskBadgeLarge.className = 'risk-level-badge ' + riskLevelClass;
    }

    if (elements.riskSummary) {
        elements.riskSummary.textContent = riskFactors.length > 0
            ? riskFactors.slice(0, 2).map(f => safeString(f)).join(' • ')
            : '';
    }

    renderKeyInsights(analysis, dataTypesCount, warnings.length, userRights.length);

    // user_friendly_summary: textContent only, no HTML.
    const summary = stripHtml(safeString(analysis.user_friendly_summary));
    if (summary && elements.userSummary && elements.summaryCard) {
        elements.userSummary.textContent = summary;
        elements.summaryCard.classList.remove('hidden');
    } else if (elements.summaryCard) {
        elements.summaryCard.classList.add('hidden');
    }

    renderDataTypes(dataTypes);
    renderChart(dataTypes);
    renderDataBlockingControls(dataTypes);
    renderDarkPatterns(analysis.dark_patterns);
    renderWarnings(warnings);
    renderUserRights(userRights);
    renderAlternatives(analysis.safer_alternatives);

    showSection('resultsSection');
}

function renderKeyInsights(analysis, dataTypesCount, warningsCount, rightsCount) {
    const insightsGrid = document.getElementById('insightsGrid');
    if (!insightsGrid) return;

    const insights = [];
    const riskLevel = safeString(analysis.risk_level);

    if (riskLevel === 'High' || riskLevel === 'Critical' || riskLevel === 'Very High') {
        insights.push({
            type: 'critical', icon: '🚨', title: 'High Privacy Risk',
            text: 'This service has concerning data collection practices. Consider alternatives or limit your data sharing.'
        });
    }
    if (dataTypesCount > 5) {
        insights.push({
            type: 'warning', icon: '📋', title: 'Extensive Data Collection',
            text: `They collect ${dataTypesCount} different types of personal data. Review what you're comfortable sharing.`
        });
    }
    if (analysis.dark_patterns && analysis.dark_patterns.detected) {
        insights.push({
            type: 'critical', icon: '⚠️', title: 'Dark Patterns Detected',
            text: `Found ${analysis.dark_patterns.count || 0} manipulative practices that may pressure you into sharing data.`
        });
    }
    const warnings = safeArray(analysis.warnings);
    if (warnings.length > 0 && insights.length < 3) {
        insights.push({
            type: 'warning', icon: '⚠️', title: 'Privacy Concern',
            text: safeString(warnings[0])
        });
    }
    if (rightsCount > 3) {
        insights.push({
            type: 'positive', icon: '✅', title: 'Good Rights Protection',
            text: `You have ${rightsCount} clearly stated privacy rights, including data access and deletion options.`
        });
    }
    if (riskLevel === 'Low' && insights.length < 3) {
        insights.push({
            type: 'positive', icon: '🛡️', title: 'Privacy-Friendly',
            text: 'This service appears to have reasonable data collection practices relative to similar services.'
        });
    }

    if (insights.length === 0) {
        insightsGrid.innerHTML = '<p class="no-data">Analysis complete. Review the detailed sections below.</p>';
        return;
    }
    insightsGrid.innerHTML = insights.slice(0, 4).map(insight => `
        <div class="insight-item ${esc(insight.type)}">
            <div class="insight-icon">${esc(insight.icon)}</div>
            <div class="insight-content">
                <h4>${esc(insight.title)}</h4>
                <p>${esc(stripHtml(insight.text))}</p>
            </div>
        </div>
    `).join('');
}

function renderDataTypes(dataTypes) {
    if (!elements.dataTypesList) return;
    const types = Object.keys(dataTypes).filter(type => {
        if (!type || typeof type !== 'string') return false;
        const value = dataTypes[type];
        if (typeof value === 'object' && value !== null) {
            return value.severity > 0 || (value.details && value.details.length > 0);
        }
        return (value || 0) > 0;
    });
    if (types.length === 0) {
        elements.dataTypesList.innerHTML = '<p class="no-data">No specific data types identified</p>';
        return;
    }
    elements.dataTypesList.innerHTML = types.map(type => {
        const icon = getDataTypeIcon(type);
        const label = getFriendlyLabel(type);
        const weight = getDataTypeWeight(type);
        const riskIndicator = weight > 10 ? '🔴' : weight > 6 ? '🟠' : weight > 3 ? '🟡' : '🟢';
        const typeData = dataTypes[type];
        const details = typeof typeData === 'object' && typeData.details && typeData.details.length > 0
            ? typeData.details.map(d => stripHtml(String(d))).join(', ')
            : getDataTypeSummary(type);
        return `
            <div class="data-type-item">
                <div class="data-type-icon">${esc(icon)}</div>
                <div class="data-type-content">
                    <span class="data-type-label">${esc(label)}</span>
                    <span class="data-type-details">${esc(details)}</span>
                </div>
                <span class="data-type-risk">${esc(riskIndicator)}</span>
            </div>
        `;
    }).join('');
}

// ============================================
// Data Blocking Controls
// ============================================
const dataTypeToBlockCategory = {
    location_data: { key: 'location', name: 'Location Data', icon: '📍', desc: 'GPS, IP-based location' },
    device_info: { key: 'device', name: 'Device Information', icon: '📱', desc: 'Hardware, browser info' },
    usage_data: { key: 'usage', name: 'Usage Tracking', icon: '📊', desc: 'Page views, clicks, behavior' },
    contact_info: { key: 'contact', name: 'Contact Information', icon: '📧', desc: 'Email, phone autofill' },
    financial_data: { key: 'financial', name: 'Financial Data', icon: '💳', desc: 'Payment, banking info' },
    biometric_data: { key: 'biometric', name: 'Biometric Data', icon: '🔐', desc: 'Fingerprint, face ID' },
    health_data: { key: 'health', name: 'Health Data', icon: '🏥', desc: 'Medical, fitness info' },
    social_data: { key: 'social', name: 'Social Data', icon: '👥', desc: 'Social login, sharing' },
    behavioral_data: { key: 'behavioral', name: 'Behavioral/Profiling', icon: '🎯', desc: 'Fingerprinting, tracking' },
    personal_info: { key: 'contact', name: 'Personal Information', icon: '👤', desc: 'Name, contact details' },
    browsing_history: { key: 'usage', name: 'Browsing History', icon: '🌐', desc: 'Sites visited, searches' },
    cookies: { key: 'behavioral', name: 'Cookies & Tracking', icon: '🍪', desc: 'Tracking cookies' },
    third_party_sharing: { key: 'usage', name: 'Third-party Sharing', icon: '🔄', desc: 'Data shared externally' },
    advertising: { key: 'behavioral', name: 'Advertising Profile', icon: '📢', desc: 'Ad targeting data' }
};

let currentBlockingPrefs = {};

async function loadBlockingPreferences() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['dataBlocking'], (result) => {
            currentBlockingPrefs = result.dataBlocking || {};
            resolve(currentBlockingPrefs);
        });
    });
}

async function saveBlockingPreferences(prefs) {
    currentBlockingPrefs = { ...currentBlockingPrefs, ...prefs };
    return new Promise((resolve) => {
        chrome.storage.local.set({ dataBlocking: currentBlockingPrefs }, resolve);
    });
}

async function renderDataBlockingControls(dataTypes) {
    if (!elements.dataBlockingList || !elements.dataBlockingCard) return;
    await loadBlockingPreferences();

    const types = Object.keys(dataTypes).filter(type => {
        if (!type || typeof type !== 'string') return false;
        const value = dataTypes[type];
        if (typeof value === 'object' && value !== null) {
            return value.severity > 0 || (value.details && value.details.length > 0);
        }
        return (value || 0) > 0;
    });
    if (types.length === 0) {
        elements.dataBlockingCard.classList.add('hidden');
        return;
    }
    elements.dataBlockingCard.classList.remove('hidden');

    const blockableCategories = new Map();
    types.forEach(type => {
        const typeLower = type.toLowerCase().replace(/\s+/g, '_');
        const mapping = dataTypeToBlockCategory[typeLower];
        if (mapping && !blockableCategories.has(mapping.key)) {
            blockableCategories.set(mapping.key, { ...mapping, originalTypes: [type] });
        } else if (mapping) {
            blockableCategories.get(mapping.key).originalTypes.push(type);
        } else {
            let matched = false;
            for (const [pattern, mp] of Object.entries(dataTypeToBlockCategory)) {
                if (typeLower.includes(pattern.split('_')[0])) {
                    if (!blockableCategories.has(mp.key)) {
                        blockableCategories.set(mp.key, { ...mp, originalTypes: [type] });
                    }
                    matched = true;
                    break;
                }
            }
            if (!matched && (typeLower.includes('track') || typeLower.includes('profile') || typeLower.includes('analytic'))) {
                if (!blockableCategories.has('behavioral')) {
                    blockableCategories.set('behavioral', {
                        key: 'behavioral', name: 'Behavioral/Profiling',
                        icon: '🎯', desc: 'Fingerprinting, tracking',
                        originalTypes: [type]
                    });
                }
            }
        }
    });

    const categories = Array.from(blockableCategories.values());
    elements.dataBlockingList.innerHTML = categories.map(cat => {
        const isBlocked = !!currentBlockingPrefs[cat.key];
        return `
            <div class="data-block-item ${isBlocked ? 'blocked' : ''}" data-category="${esc(cat.key)}">
                <div class="data-block-info">
                    <div class="data-block-icon">${esc(cat.icon)}</div>
                    <div class="data-block-text">
                        <span class="data-block-name">${esc(cat.name)}</span>
                        <span class="data-block-desc">${esc(cat.desc)}</span>
                    </div>
                </div>
                <span class="data-block-status ${isBlocked ? 'blocked' : 'active'}">${isBlocked ? 'Blocked' : 'Allowed'}</span>
                <label class="data-block-toggle">
                    <input type="checkbox" data-category="${esc(cat.key)}" ${isBlocked ? 'checked' : ''}>
                    <span class="data-block-slider"></span>
                </label>
            </div>
        `;
    }).join('');

    elements.dataBlockingList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleDataBlockToggle);
    });
    updateBlockAllButton();
}

async function handleDataBlockToggle(event) {
    const checkbox = event.target;
    const category = checkbox.dataset.category;
    const isBlocked = checkbox.checked;
    await saveBlockingPreferences({ [category]: isBlocked });
    const item = checkbox.closest('.data-block-item');
    if (item) {
        item.classList.toggle('blocked', isBlocked);
        const status = item.querySelector('.data-block-status');
        if (status) {
            status.textContent = isBlocked ? 'Blocked' : 'Allowed';
            status.classList.toggle('blocked', isBlocked);
            status.classList.toggle('active', !isBlocked);
        }
    }
    updateBlockAllButton();
    showBlockingNotification(category, isBlocked);
}

function updateBlockAllButton() {
    if (!elements.blockAllDataBtn || !elements.dataBlockingList) return;
    const checkboxes = elements.dataBlockingList.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length === 0) return;
    const allBlocked = Array.from(checkboxes).every(cb => cb.checked);
    elements.blockAllDataBtn.textContent = allBlocked ? 'Unblock All' : 'Block All';
    elements.blockAllDataBtn.classList.toggle('unblock', allBlocked);
}

async function handleBlockAllData() {
    if (!elements.dataBlockingList) return;
    const checkboxes = elements.dataBlockingList.querySelectorAll('input[type="checkbox"]');
    const allBlocked = Array.from(checkboxes).every(cb => cb.checked);
    const newState = !allBlocked;
    const prefs = {};
    checkboxes.forEach(cb => {
        cb.checked = newState;
        prefs[cb.dataset.category] = newState;
        const item = cb.closest('.data-block-item');
        if (item) {
            item.classList.toggle('blocked', newState);
            const status = item.querySelector('.data-block-status');
            if (status) {
                status.textContent = newState ? 'Blocked' : 'Allowed';
                status.classList.toggle('blocked', newState);
                status.classList.toggle('active', !newState);
            }
        }
    });
    await saveBlockingPreferences(prefs);
    updateBlockAllButton();
    showBlockingNotification('all', newState);
}

function showBlockingNotification(category, isBlocked) {
    const notification = document.createElement('div');
    notification.className = 'blocking-notification';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'notif-icon';
    iconSpan.textContent = isBlocked ? '🔒' : '🔓';
    const textSpan = document.createElement('span');
    textSpan.className = 'notif-text';
    textSpan.textContent = (category === 'all' ? 'All data types' : category) + (isBlocked ? ' blocked' : ' unblocked');
    notification.appendChild(iconSpan);
    notification.appendChild(textSpan);

    notification.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: ${isBlocked ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#22c55e,#16a34a)'};
        color: white; padding: 10px 20px; border-radius: 25px;
        font-size: 0.8rem; font-weight: 600;
        display: flex; align-items: center; gap: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 10000;
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

const notifStyles = document.createElement('style');
notifStyles.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
`;
document.head.appendChild(notifStyles);

if (elements.blockAllDataBtn) {
    elements.blockAllDataBtn.addEventListener('click', handleBlockAllData);
}

// ============================================
// Chart
// ============================================
function renderChart(dataTypes) {
    const canvas = document.getElementById('dataChart');
    if (!canvas) return;
    if (typeof Chart === 'undefined') {
        canvas.style.display = 'none';
        if (elements.chartLegend) {
            elements.chartLegend.innerHTML = '<p class="no-data">Chart library not loaded</p>';
        }
        return;
    }
    if (state.chart) state.chart.destroy();

    const types = Object.keys(dataTypes).filter(type => {
        if (!type || typeof type !== 'string') return false;
        const value = dataTypes[type];
        if (typeof value === 'object' && value !== null) return value.severity > 0;
        return (value || 0) > 0;
    });
    if (types.length === 0) {
        canvas.style.display = 'none';
        if (elements.chartLegend) elements.chartLegend.innerHTML = '<p class="no-data">No data to display</p>';
        return;
    }
    canvas.style.display = 'block';

    const labels = types.map(t => getFriendlyLabel(t));
    const weights = types.map(t => getDataTypeWeight(t));
    const colors = types.map((_, i) => chartColors[i % chartColors.length]);

    const ctx = canvas.getContext('2d');
    state.chart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: weights, backgroundColor: colors, borderColor: '#1a1a1a', borderWidth: 2 }] },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#fff', bodyColor: '#fff', padding: 12, cornerRadius: 8 }
            },
            cutout: '60%'
        }
    });

    const initialItems = 8;
    const hasMore = types.length > initialItems;
    state.legendTypes = types;
    state.legendColors = colors;
    state.legendExpanded = false;

    renderLegendItems(
        types.slice(0, initialItems),
        colors.slice(0, initialItems),
        hasMore ? types.length - initialItems : 0
    );
}

function renderLegendItems(types, colors, moreCount) {
    if (!elements.chartLegend) return;
    elements.chartLegend.innerHTML = types.map((type, i) => `
        <div class="legend-item">
            <span class="legend-color" style="background-color: ${esc(colors[i])}"></span>
            <span class="legend-label">${esc(getDataTypeIcon(type))} ${esc(getFriendlyLabel(type))}</span>
        </div>
    `).join('');

    if (moreCount > 0) {
        elements.chartLegend.insertAdjacentHTML('beforeend',
            `<button class="legend-item legend-more" id="legendExpandBtn" type="button">+${moreCount} more</button>`
        );
        const expandBtn = document.getElementById('legendExpandBtn');
        if (expandBtn) expandBtn.addEventListener('click', toggleLegendExpand);
    }
}

function toggleLegendExpand() {
    if (!state.legendTypes || !state.legendColors || !elements.chartLegend) return;
    state.legendExpanded = !state.legendExpanded;
    if (state.legendExpanded) {
        elements.chartLegend.innerHTML = state.legendTypes.map((type, i) => `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${esc(state.legendColors[i])}"></span>
                <span class="legend-label">${esc(getDataTypeIcon(type))} ${esc(getFriendlyLabel(type))}</span>
            </div>
        `).join('');
        elements.chartLegend.insertAdjacentHTML('beforeend',
            '<button class="legend-item legend-more legend-collapse" id="legendCollapseBtn" type="button">Show less</button>'
        );
        const collapseBtn = document.getElementById('legendCollapseBtn');
        if (collapseBtn) collapseBtn.addEventListener('click', toggleLegendExpand);
    } else {
        const initialItems = 8;
        const moreCount = state.legendTypes.length - initialItems;
        renderLegendItems(state.legendTypes.slice(0, initialItems), state.legendColors.slice(0, initialItems), moreCount);
    }
}

// ============================================
// Other render helpers (XSS-safe)
// ============================================
function renderDarkPatterns(darkPatterns) {
    if (!elements.darkPatternsCard) return;
    if (!darkPatterns || !darkPatterns.detected || !Array.isArray(darkPatterns.patterns) || !darkPatterns.patterns.length) {
        elements.darkPatternsCard.classList.add('hidden');
        return;
    }
    elements.darkPatternsCard.classList.remove('hidden');

    const severityStyles = {
        critical: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        high:     { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
        medium:   { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
        low:      { bg: '#f7fee7', color: '#65a30d', border: '#bef264' }
    };
    const severity = darkPatterns.severity || 'medium';
    const style = severityStyles[severity] || severityStyles.medium;

    if (elements.darkPatternsSeverity) {
        elements.darkPatternsSeverity.textContent = String(severity).toUpperCase();
        elements.darkPatternsSeverity.style.backgroundColor = style.bg;
        elements.darkPatternsSeverity.style.color = style.color;
        elements.darkPatternsSeverity.style.borderColor = style.border;
    }
    if (elements.darkPatternsCount) {
        elements.darkPatternsCount.textContent = `Found ${darkPatterns.count || 0} concerning practice${(darkPatterns.count || 0) > 1 ? 's' : ''}`;
    }
    if (!elements.darkPatternsList) return;

    elements.darkPatternsList.innerHTML = darkPatterns.patterns.map(pattern => {
        const pStyle = severityStyles[pattern.severity] || severityStyles.medium;
        const title = stripHtml(safeString(pattern.title));
        const description = stripHtml(safeString(pattern.description));
        const recommendation = stripHtml(safeString(pattern.recommendation));
        const examples = (pattern.examples || []).map(ex => stripHtml(safeString(ex)));
        return `
            <div class="dark-pattern-card" style="border-left-color: ${esc(pStyle.color)}">
                <div class="pattern-header">
                    <span class="pattern-title">${esc(title)}</span>
                    <span class="pattern-severity" style="background-color: ${esc(pStyle.bg)}; color: ${esc(pStyle.color)}">${esc(pattern.severity || '')}</span>
                </div>
                <p class="pattern-description">${esc(description)}</p>
                ${examples.length ? `
                    <div class="pattern-examples">
                        <span class="examples-label">Found:</span>
                        ${examples.map(ex => `<span class="example-tag">${esc(ex)}</span>`).join('')}
                    </div>` : ''}
                ${recommendation ? `
                    <div class="pattern-recommendation">
                        <span class="recommendation-icon">💡</span>
                        <span>${esc(recommendation)}</span>
                    </div>` : ''}
            </div>
        `;
    }).join('');
}

function renderWarnings(warnings) {
    if (!elements.warningsCard || !elements.warningsList) return;
    if (!warnings || warnings.length === 0) {
        elements.warningsCard.classList.add('hidden');
        return;
    }
    elements.warningsCard.classList.remove('hidden');
    elements.warningsList.innerHTML = warnings.map(warning => {
        const text = stripHtml(safeString(warning));
        return text ? `<div class="warning-item"><span class="warning-icon">⚠️</span><span>${esc(text)}</span></div>` : '';
    }).filter(Boolean).join('');
}

function renderUserRights(rights) {
    if (!elements.rightsCard || !elements.rightsList) return;
    if (!rights || rights.length === 0) {
        elements.rightsCard.classList.add('hidden');
        return;
    }
    elements.rightsCard.classList.remove('hidden');
    elements.rightsList.innerHTML = rights.map(right => {
        const text = stripHtml(safeString(right));
        return text ? `<div class="right-item"><span class="right-icon">✓</span><span>${esc(text)}</span></div>` : '';
    }).filter(Boolean).join('');
}

function renderAlternatives(alternatives) {
    if (!elements.alternativesCard || !elements.alternativesList) return;
    if (!alternatives || !Array.isArray(alternatives.alternatives) || alternatives.alternatives.length === 0) {
        elements.alternativesCard.classList.add('hidden');
        return;
    }
    elements.alternativesCard.classList.remove('hidden');
    elements.alternativesList.innerHTML = alternatives.alternatives.map(alt => {
        const name = stripHtml(safeString(alt.name));
        const description = stripHtml(safeString(alt.description));
        const score = alt.privacy_score ? String(alt.privacy_score) : '';
        const pros = (alt.pros || []).slice(0, 3).map(p => stripHtml(safeString(p)));
        return `
            <div class="alternative-item">
                <div class="alt-header">
                    <span class="alt-name">${esc(name)}</span>
                    ${score ? `<span class="alt-score">${esc(score)}/10</span>` : ''}
                </div>
                <p class="alt-description">${esc(description)}</p>
                ${pros.length ? `
                    <div class="alt-pros">
                        ${pros.map(p => `<span class="pro-tag">✓ ${esc(p)}</span>`).join('')}
                    </div>` : ''}
            </div>
        `;
    }).join('');
}

// ============================================
// API Functions (with retry)
// ============================================
async function fetchWithRetry(url, opts, retries = config.MAX_RETRIES) {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
        try {
            const resp = await fetch(url, opts);
            // 5xx -> retry; 4xx -> return immediately
            if (resp.status >= 500 && i < retries) {
                lastErr = new Error('Server error: ' + resp.status);
                await new Promise(r => setTimeout(r, 1500 * (i + 1)));
                continue;
            }
            return resp;
        } catch (e) {
            lastErr = e;
            if (e.name === 'AbortError') throw e; // don't retry timeouts
            if (i < retries) await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        }
    }
    throw lastErr;
}

async function analyzePrivacyPolicy() {
    const urlToAnalyze = elements.urlInput.value.trim();
    if (!urlToAnalyze) {
        renderError({ message: 'Please enter a website URL or privacy policy URL', code: 'INVALID_INPUT' });
        return;
    }
    const processedUrl = normalizeUrl(urlToAnalyze);
    if (!processedUrl) {
        renderError({ message: 'Please enter a valid URL (e.g., google.com or https://example.com)', code: 'INVALID_URL' });
        return;
    }

    state.url = processedUrl;
    state.loading = true;
    state.error = null;
    state.analysis = null;
    state.progress = 0;
    state.currentStep = 0;

    const urlType = detectUrlType(processedUrl);
    state.analysisType = urlType;

    elements.urlInput.value = processedUrl;
    elements.analyzeBtn.disabled = true;
    elements.analyzeBtn.innerHTML = '<div class="spinner"></div><span>Analyzing...</span>';

    const steps = urlType === 'direct' ? directSteps : websiteSteps;
    renderLoadingSteps(steps, 0);
    showSection('loadingSection');

    const progressInterval = setInterval(() => {
        if (state.progress < 90) {
            state.progress += Math.random() * 10;
            updateProgress(Math.min(state.progress, 90));
        }
    }, 500);
    const stepInterval = setInterval(() => {
        if (state.currentStep < steps.length - 1) {
            state.currentStep++;
            renderLoadingSteps(steps, state.currentStep);
        }
    }, 2000);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.TIMEOUT);

        const endpoint = urlType === 'direct'
            ? `${BACKEND_URL}/analyze-direct-policy`
            : `${BACKEND_URL}/fetch-privacy-policy`;

        const response = await fetchWithRetry(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: processedUrl }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            if (result && result.error_code) {
                throw {
                    message: result.user_message || result.error || 'Failed to fetch privacy policy',
                    code: result.error_code,
                    reason: result.error_reason,
                    suggestions: result.suggestions || []
                };
            } else if (response.status === 404) {
                throw { message: 'Privacy policy not found on this website', code: 'NOT_FOUND' };
            } else if (response.status === 408) {
                throw { message: 'Request timed out. The website may be slow to respond.', code: 'TIMEOUT' };
            } else if (response.status === 429) {
                throw { message: 'Rate limited. Please try again later.', code: 'RATE_LIMITED' };
            } else {
                throw { message: `Request failed with status ${response.status}`, code: 'SERVER_ERROR' };
            }
        }

        if (result && result.error && !result.success) {
            throw {
                message: result.user_message || result.error,
                code: result.error_code || 'UNKNOWN',
                suggestions: result.suggestions || []
            };
        }

        if (urlType === 'direct') {
            state.analysis = result;
        } else if (result && result.policy_text) {
            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), config.TIMEOUT);
            const analysisResponse = await fetchWithRetry(`${BACKEND_URL}/analyze-policy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ policy_text: result.policy_text, website_url: processedUrl }),
                signal: controller2.signal
            });
            clearTimeout(timeout2);
            if (!analysisResponse.ok) {
                throw { message: 'Failed to analyze policy content', code: 'ANALYSIS_ERROR' };
            }
            state.analysis = await analysisResponse.json();
        } else if (result && result.analysis) {
            state.analysis = result.analysis;
        } else {
            state.analysis = result;
        }

        clearInterval(progressInterval);
        clearInterval(stepInterval);
        updateProgress(100);
        renderLoadingSteps(steps, steps.length);
        setTimeout(() => renderResults(state.analysis), 500);
    } catch (err) {
        clearInterval(progressInterval);
        clearInterval(stepInterval);

        console.error('Analysis error:', err);
        if (err.name === 'AbortError') {
            renderError({ message: 'Request timed out. The backend may be cold-starting.', code: 'TIMEOUT' });
        } else if (err.message && err.code) {
            renderError(err);
        } else {
            renderError({ message: err.message || 'Failed to analyze privacy policy', code: 'UNKNOWN' });
        }
    } finally {
        state.loading = false;
        elements.analyzeBtn.disabled = false;
        elements.analyzeBtn.innerHTML = `
            <svg class="shield-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Analyze Privacy Policy</span>
        `;
    }
}

// ============================================
// Chrome API helpers
// ============================================
async function getCurrentTabUrl() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                return tab.url;
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting current tab:', error);
        return null;
    }
}

function getDomainFromUrl(url) {
    try { return new URL(url).hostname; } catch { return url; }
}

// ============================================
// Blocking UI
// ============================================
const blockingElements = {
    toggle: document.getElementById('blockingToggle'),
    shieldIcon: document.getElementById('shieldIcon'),
    blockedCount: document.getElementById('blockedCount'),
    analyticsCount: document.getElementById('analyticsCount'),
    advertisingCount: document.getElementById('advertisingCount'),
    socialCount: document.getElementById('socialCount'),
    marketingCount: document.getElementById('marketingCount'),
    fingerprintingCount: document.getElementById('fingerprintingCount'),
    showTrackersBtn: document.getElementById('showTrackersBtn'),
    expandIcon: document.getElementById('expandIcon'),
    blockedTrackersList: document.getElementById('blockedTrackersList'),
    trackersEmpty: document.getElementById('trackersEmpty'),
    trackersContainer: document.getElementById('trackersContainer'),
    resetStatsBtn: document.getElementById('resetStatsBtn')
};

async function resetBlockingStats() {
    try {
        await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
        if (blockingElements.blockedCount) blockingElements.blockedCount.textContent = '0';
        if (blockingElements.analyticsCount) blockingElements.analyticsCount.textContent = '0';
        if (blockingElements.advertisingCount) blockingElements.advertisingCount.textContent = '0';
        if (blockingElements.socialCount) blockingElements.socialCount.textContent = '0';
        if (blockingElements.marketingCount) blockingElements.marketingCount.textContent = '0';
        if (blockingElements.fingerprintingCount) blockingElements.fingerprintingCount.textContent = '0';
        if (blockingElements.trackersContainer) blockingElements.trackersContainer.replaceChildren();
        if (blockingElements.trackersEmpty) blockingElements.trackersEmpty.classList.remove('hidden');

        if (blockingElements.resetStatsBtn) {
            blockingElements.resetStatsBtn.textContent = '✓';
            setTimeout(() => {
                if (blockingElements.resetStatsBtn) blockingElements.resetStatsBtn.textContent = '🗑️';
            }, 1000);
        }
    } catch (error) {
        console.error('Error resetting stats:', error);
    }
}

function renderBlockedTrackers(blockedDomains) {
    if (!blockingElements.trackersContainer || !blockingElements.trackersEmpty) return;
    if (!blockedDomains || Object.keys(blockedDomains).length === 0) {
        blockingElements.trackersEmpty.classList.remove('hidden');
        blockingElements.trackersContainer.replaceChildren();
        return;
    }
    blockingElements.trackersEmpty.classList.add('hidden');
    const sortedDomains = Object.entries(blockedDomains).sort((a, b) => b[1] - a[1]).slice(0, 20);
    blockingElements.trackersContainer.innerHTML = sortedDomains.map(([domain, count]) => `
        <div class="tracker-item">
            <span class="tracker-domain" title="${esc(domain)}">🚫 ${esc(domain)}</span>
            <span class="tracker-count">${esc(count)}×</span>
        </div>
    `).join('');
}

function toggleTrackersList() {
    if (!blockingElements.blockedTrackersList || !blockingElements.expandIcon || !blockingElements.showTrackersBtn) return;
    const isHidden = blockingElements.blockedTrackersList.classList.contains('hidden');
    if (isHidden) {
        blockingElements.blockedTrackersList.classList.remove('hidden');
        blockingElements.expandIcon.classList.add('rotated');
        const span = blockingElements.showTrackersBtn.querySelector('span:first-child');
        if (span) span.textContent = 'Hide blocked trackers';
    } else {
        blockingElements.blockedTrackersList.classList.add('hidden');
        blockingElements.expandIcon.classList.remove('rotated');
        const span = blockingElements.showTrackersBtn.querySelector('span:first-child');
        if (span) span.textContent = 'Show blocked trackers';
    }
}

function updateBlockingStats(stats) {
    if (!stats || !blockingElements.blockedCount) return;
    const currentCount = parseInt(blockingElements.blockedCount.textContent, 10) || 0;
    const newCount = stats.totalBlocked || 0;
    if (newCount !== currentCount) {
        blockingElements.blockedCount.textContent = newCount;
        blockingElements.blockedCount.style.transform = 'scale(1.1)';
        setTimeout(() => { blockingElements.blockedCount.style.transform = 'scale(1)'; }, 200);
    }
    const categories = stats.blockedByCategory || {};
    if (blockingElements.analyticsCount) blockingElements.analyticsCount.textContent = categories.analytics || 0;
    if (blockingElements.advertisingCount) blockingElements.advertisingCount.textContent = categories.advertising || 0;
    if (blockingElements.socialCount) blockingElements.socialCount.textContent = categories.social || 0;
    if (blockingElements.marketingCount) blockingElements.marketingCount.textContent = categories.marketing || 0;
    if (blockingElements.fingerprintingCount) blockingElements.fingerprintingCount.textContent = categories.fingerprinting || 0;
    renderBlockedTrackers(stats.blockedDomains);
}

function updateBlockingToggle(enabled) {
    if (!blockingElements.toggle || !blockingElements.shieldIcon) return;
    blockingElements.toggle.checked = enabled;
    blockingElements.shieldIcon.className = enabled ? 'shield-active' : 'shield-inactive';
    blockingElements.shieldIcon.textContent = '🛡️';
}

async function handleBlockingToggleSP() {
    const enabled = blockingElements.toggle.checked;
    updateBlockingToggle(enabled);
    try {
        await chrome.runtime.sendMessage({ type: 'TOGGLE_BLOCKING', enabled });
    } catch (error) {
        console.error('Error toggling blocking:', error);
        blockingElements.toggle.checked = !enabled;
        updateBlockingToggle(!enabled);
    }
}

async function initBlockingUI() {
    try {
        const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKING_STATUS' });
        if (statusResponse) updateBlockingToggle(statusResponse.enabled !== false);

        const statsResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKING_STATS' });
        if (statsResponse && statsResponse.stats) updateBlockingStats(statsResponse.stats);
    } catch (error) {
        console.error('Error initializing blocking UI:', error);
    }
}

if (blockingElements.toggle) blockingElements.toggle.addEventListener('change', handleBlockingToggleSP);
if (blockingElements.showTrackersBtn) blockingElements.showTrackersBtn.addEventListener('click', toggleTrackersList);
if (blockingElements.resetStatsBtn) blockingElements.resetStatsBtn.addEventListener('click', resetBlockingStats);

if (elements.urlForm) {
    elements.urlForm.addEventListener('submit', (e) => { e.preventDefault(); analyzePrivacyPolicy(); });
}
if (elements.clearBtn) {
    elements.clearBtn.addEventListener('click', () => {
        if (elements.urlInput) elements.urlInput.value = '';
        state.url = '';
        updateUrlTypeIndicator();
    });
}

const policyToggleBtn = document.getElementById('policyToggleBtn');
const policyContent = document.getElementById('policyContent');
const policyExpandIcon = document.getElementById('policyExpandIcon');
if (policyToggleBtn && policyContent && policyExpandIcon) {
    policyToggleBtn.addEventListener('click', () => {
        const isHidden = policyContent.classList.contains('hidden');
        if (isHidden) {
            policyContent.classList.remove('hidden');
            policyExpandIcon.classList.add('rotated');
        } else {
            policyContent.classList.add('hidden');
            policyExpandIcon.classList.remove('rotated');
        }
    });
}

if (elements.urlInput) elements.urlInput.addEventListener('input', updateUrlTypeIndicator);
if (elements.retryBtn) elements.retryBtn.addEventListener('click', () => showSection('inputSection'));
if (elements.searchGoogleBtn) elements.searchGoogleBtn.addEventListener('click', () => {
    try {
        const domain = getDomainFromUrl(state.url);
        window.open('https://www.google.com/search?q=' + encodeURIComponent(domain + ' privacy policy'), '_blank');
    } catch {
        window.open('https://www.google.com/search?q=' + encodeURIComponent(state.url + ' privacy policy'), '_blank');
    }
});
if (elements.newAnalysisBtn) elements.newAnalysisBtn.addEventListener('click', () => {
    showSection('inputSection');
    initCurrentTab();
});

chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    if (message.type === 'TAB_CHANGED' || message.type === 'URL_CHANGED') {
        if (message.url && !message.url.startsWith('chrome://') && elements.urlInput) {
            elements.urlInput.value = message.url;
            if (elements.currentDomain) elements.currentDomain.textContent = getDomainFromUrl(message.url);
            updateUrlTypeIndicator();
        }
    }
    if (message.type === 'TRACKER_BLOCKED') {
        updateBlockingStats(message.stats);
    }
});

async function initCurrentTab() {
    const currentUrl = await getCurrentTabUrl();
    if (currentUrl && elements.urlInput) {
        elements.urlInput.value = currentUrl;
        if (elements.currentDomain) elements.currentDomain.textContent = getDomainFromUrl(currentUrl);
        updateUrlTypeIndicator();
    } else {
        if (elements.currentDomain) elements.currentDomain.textContent = 'No website detected';
        if (elements.urlTypeText) elements.urlTypeText.textContent = 'Enter a URL to analyze';
    }
}

// Warm backend (combats Render free-tier cold start).
function warmBackend() {
    try {
        fetch(BACKEND_URL + '/health', { method: 'GET', mode: 'cors' }).catch(() => {});
    } catch (_) {}
}

async function init() {
    await initCurrentTab();
    await initBlockingUI();
    warmBackend();
}

document.addEventListener('DOMContentLoaded', init);
