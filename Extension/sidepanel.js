// Privacy Browser - Side Panel JavaScript
// Main application logic for Chrome extension

// ============================================
// Configuration
// ============================================
const config = {
    BACKEND_URL: 'http://98.130.128.254',  // EC2 backend
    DEV_BACKEND_URL: 'http://localhost:5001',
    TIMEOUT: 60000,
    MAX_RETRIES: 3
};

// Use production URL (change to DEV_BACKEND_URL for local development)
const BACKEND_URL = config.BACKEND_URL;

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
    chart: null
};

// Analysis steps
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

// Chart colors
const chartColors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
    "#06b6d4", "#84cc16", "#f97316", "#ef4444", "#6b7280"
];

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Input section
    urlInput: document.getElementById('urlInput'),
    urlForm: document.getElementById('urlForm'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    clearBtn: document.getElementById('clearBtn'),
    currentDomain: document.getElementById('currentDomain'),
    urlTypeText: document.getElementById('urlTypeText'),
    urlTypeIndicator: document.getElementById('urlTypeIndicator'),

    // Sections
    inputSection: document.getElementById('inputSection'),
    loadingSection: document.getElementById('loadingSection'),
    errorSection: document.getElementById('errorSection'),
    resultsSection: document.getElementById('resultsSection'),

    // Loading
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    stepsList: document.getElementById('stepsList'),

    // Error
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

    // Results
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
    metricsDashboard: document.getElementById('metricsDashboard')
};

// Setup clickable metric cards
document.querySelectorAll('.clickable-card[data-scroll-to]').forEach(card => {
    card.addEventListener('click', () => {
        const targetId = card.getAttribute('data-scroll-to');
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            // Scroll to the target with smooth behavior
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

            // Brief highlight effect
            targetElement.style.transition = 'box-shadow 0.3s ease';
            targetElement.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.5)';
            setTimeout(() => {
                targetElement.style.boxShadow = '';
            }, 1500);
        }
    });
});

// ============================================
// Utility Functions
// ============================================

// Safe string conversion
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

// Safe array conversion
function safeArray(value) {
    if (Array.isArray(value)) return value;
    return [];
}

// ============================================
// Privacy Policy Change Detection
// ============================================

// Generate a simple hash of the analysis content
function generatePolicyHash(analysis) {
    if (!analysis) return null;

    // Create a string from key analysis data
    const keyData = [
        analysis.risk_level || '',
        (safeArray(analysis.data_types)).join('|'),
        (safeArray(analysis.warnings)).slice(0, 5).map(w => safeString(w)).join('|'),
        (safeArray(analysis.user_rights)).slice(0, 5).map(r => safeString(r)).join('|')
    ].join('::');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < keyData.length; i++) {
        const char = keyData.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

// Store policy hash
async function storePolicyHash(domain, hash, analysis) {
    try {
        const { policyHashes = {} } = await chrome.storage.local.get('policyHashes');

        const previousHash = policyHashes[domain]?.hash;
        const hasChanged = previousHash && previousHash !== hash;

        policyHashes[domain] = {
            hash: hash,
            lastChecked: Date.now(),
            riskLevel: analysis.risk_level,
            previousHash: previousHash || null,
            changeDetected: hasChanged
        };

        // Keep only last 200 domains
        const domains = Object.keys(policyHashes);
        if (domains.length > 200) {
            const sorted = domains.sort((a, b) =>
                policyHashes[a].lastChecked - policyHashes[b].lastChecked
            );
            sorted.slice(0, domains.length - 200).forEach(d => delete policyHashes[d]);
        }

        await chrome.storage.local.set({ policyHashes });

        return { hasChanged, previousHash };
    } catch (error) {
        console.error('Error storing policy hash:', error);
        return { hasChanged: false, previousHash: null };
    }
}

// Check if policy has changed
async function checkPolicyChange(domain) {
    try {
        const { policyHashes = {} } = await chrome.storage.local.get('policyHashes');
        return policyHashes[domain] || null;
    } catch (error) {
        console.error('Error checking policy change:', error);
        return null;
    }
}

// Show policy change notification
function showPolicyChangeNotification(domain, previousRisk) {
    const notification = document.createElement('div');
    notification.className = 'policy-change-notification';
    notification.innerHTML = `
        <div class="change-icon">🔔</div>
        <div class="change-content">
            <div class="change-title">Privacy Policy Changed!</div>
            <div class="change-text">${domain} has updated their privacy policy since your last analysis.</div>
            ${previousRisk ? `<div class="change-previous">Previous risk level: ${previousRisk}</div>` : ''}
        </div>
        <button class="change-dismiss" onclick="this.parentElement.remove()">×</button>
    `;

    // Add styles if not already present
    if (!document.getElementById('policy-change-styles')) {
        const styles = document.createElement('style');
        styles.id = 'policy-change-styles';
        styles.textContent = `
            .policy-change-notification {
                position: fixed;
                top: 10px;
                left: 10px;
                right: 10px;
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
                padding: 12px;
                border-radius: 10px;
                display: flex;
                align-items: flex-start;
                gap: 10px;
                box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
                z-index: 10000;
                animation: slideDown 0.3s ease;
            }
            .change-icon { font-size: 1.5rem; }
            .change-content { flex: 1; }
            .change-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 4px; }
            .change-text { font-size: 0.75rem; opacity: 0.9; }
            .change-previous { font-size: 0.7rem; opacity: 0.8; margin-top: 4px; }
            .change-dismiss {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 1rem;
            }
            @keyframes slideDown {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}


// Safe object conversion
function safeObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    return {};
}

// Get friendly label for data type
function getFriendlyLabel(dataType) {
    if (!dataType || typeof dataType !== 'string') return 'Unknown Data Type';

    const friendlyLabels = {
        phone: 'Phone Numbers',
        browsing: 'Browsing & Device Info',
        id: 'Government/ID Documents',
        social: 'Social Media Accounts',
        email: 'Email Addresses',
        location: 'Location Information',
        payment: 'Payment & Financial Info',
        name: 'Name/Username',
        age: 'Age/Birthdate',
        biometric: 'Biometric Data',
        health: 'Health/Medical Info',
        education: 'Education Details',
        employment: 'Employment Details',
        behavior: 'Preferences & Interests',
        content: 'Photos & Videos',
        communication: 'Messages & Chats',
        device: 'Device Information',
        demographic: 'Demographic Data',
        advertising: 'Advertising Data',
        usage: 'Usage Patterns',
        network: 'Network Information',
        camera: 'Camera Access',
        microphone: 'Microphone Access',
        calendar: 'Calendar Data',
        contacts: 'Contact List',
        files: 'Files & Documents',
        app_usage: 'App Usage Data',
        purchase: 'Purchase History',
        search: 'Search History',
        profile: 'Profile Information',
        account: 'Account Data',
        login: 'Login Information',
        activity: 'Activity Data',
        preferences: 'User Preferences',
        interests: 'Interests & Hobbies',
        relationships: 'Relationship Data',
        political: 'Political Views',
        religious: 'Religious Beliefs',
        sexual_orientation: 'Sexual Orientation',
        ethnicity: 'Ethnicity & Race',
        gender: 'Gender Identity',
        income: 'Income & Financial Status',
        family: 'Family Information',
        travel: 'Travel Data',
        shopping: 'Shopping Behavior',
        entertainment: 'Entertainment Preferences',
        news: 'News Preferences',
        sports: 'Sports Data',
        music: 'Music Preferences',
        gaming: 'Gaming Data',
        search_history: 'Search History',
        location_history: 'Location History',
        browsing_history: 'Browsing History',
        voice_data: 'Voice Data',
        social_graph: 'Social Graph',
        content_analysis: 'Content Analysis',
        behavioral_targeting: 'Behavioral Targeting',
        cross_platform_tracking: 'Cross-Platform Tracking',
        purchase_history: 'Purchase History',
        shopping_behavior: 'Shopping Behavior',
        product_preferences: 'Product Preferences',
        voice_commands: 'Voice Commands'
    };

    return friendlyLabels[dataType] || dataType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Get icon for data type
function getDataTypeIcon(dataType) {
    if (!dataType || typeof dataType !== 'string') return '📄';

    const icons = {
        'email': '📧', 'phone': '📱', 'name': '👤', 'age': '🎂', 'id': '🆔',
        'location': '📍', 'browsing': '🌐', 'network': '🌍',
        'payment': '💳', 'biometric': '🫵', 'health': '🏥',
        'social': '👥', 'communication': '💬', 'content': '📸', 'relationships': '💕',
        'device': '📱', 'camera': '📷', 'microphone': '🎤', 'files': '📁',
        'behavior': '🧠', 'activity': '📊', 'usage': '📈', 'app_usage': '📱',
        'preferences': '⚙️', 'interests': '🎯', 'search': '🔍',
        'demographic': '📊', 'advertising': '📢', 'profile': '👤', 'account': '🔐',
        'political': '🗳️', 'religious': '⛪', 'sexual_orientation': '🏳️‍🌈',
        'ethnicity': '🌍', 'gender': '⚧', 'income': '💰', 'family': '👨‍👩‍👧‍👦',
        'travel': '✈️', 'shopping': '🛒', 'entertainment': '🎬', 'news': '📰',
        'sports': '⚽', 'music': '🎵', 'gaming': '🎮', 'calendar': '📅',
        'contacts': '📞', 'purchase': '🛍️', 'login': '🔑', 'education': '🎓',
        'employment': '💼',
        'search_history': '🔍', 'location_history': '📍', 'browsing_history': '🌐',
        'voice_data': '🎤', 'social_graph': '👥', 'content_analysis': '📊',
        'behavioral_targeting': '🎯', 'cross_platform_tracking': '🔄',
        'purchase_history': '🛒', 'shopping_behavior': '🛍️', 'product_preferences': '⭐',
        'voice_commands': '🎙️'
    };

    return icons[dataType] || '📄';
}

// Get data type weight for chart sizing
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

// Get summary description for data type
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

// Normalize URL
function normalizeUrl(input) {
    if (!input || !input.trim()) return null;

    let normalized = input.trim();
    normalized = normalized.replace(/^(https?:\/\/)+/i, 'https://');

    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = `https://${normalized}`;
    }

    try {
        new URL(normalized);
        return normalized;
    } catch {
        return null;
    }
}

// Detect URL type (direct policy vs website)
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

// Get error category info
function getErrorCategory(code) {
    const categories = {
        'BOT_PROTECTION': { icon: '🛡️', label: 'Bot Protection', severity: 'warning' },
        'JAVASCRIPT_REQUIRED': { icon: '📜', label: 'JavaScript Required', severity: 'info' },
        'CAPTCHA_REQUIRED': { icon: '🤖', label: 'CAPTCHA Required', severity: 'warning' },
        'ACCESS_DENIED': { icon: '⛔', label: 'Access Denied', severity: 'error' },
        'TIMEOUT': { icon: '⏱️', label: 'Timeout', severity: 'warning' },
        'CONNECTION_FAILED': { icon: '🔌', label: 'Connection Failed', severity: 'error' },
        'SSL_ERROR': { icon: '🔒', label: 'SSL Error', severity: 'error' },
        'SERVER_ERROR': { icon: '🔧', label: 'Server Error', severity: 'error' },
        'RATE_LIMITED': { icon: '⏳', label: 'Rate Limited', severity: 'warning' },
        'LOGIN_REQUIRED': { icon: '🔐', label: 'Login Required', severity: 'info' },
        'GEO_BLOCKED': { icon: '🌍', label: 'Geo-Blocked', severity: 'warning' },
        'NOT_FOUND': { icon: '🔍', label: 'Not Found', severity: 'info' },
        'PAGE_NOT_FOUND': { icon: '🔍', label: 'Page Not Found', severity: 'info' },
        'NETWORK_ERROR': { icon: '📡', label: 'Network Error', severity: 'error' }
    };
    return categories[code] || { icon: '❓', label: code || 'Unknown Error', severity: 'error' };
}

// Get risk level color and styling
function getRiskStyle(riskLevel) {
    const styles = {
        'Low': { bg: '#dcfce7', color: '#166534', border: '#86efac' },
        'Medium': { bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
        'High': { bg: '#fed7aa', color: '#c2410c', border: '#fdba74' },
        'Very High': { bg: '#fecaca', color: '#991b1b', border: '#fca5a5' },
        'Critical': { bg: '#fecaca', color: '#7f1d1d', border: '#f87171' }
    };
    return styles[riskLevel] || { bg: '#e5e7eb', color: '#374151', border: '#d1d5db' };
}

// ============================================
// UI Functions
// ============================================

// Show/hide sections
function showSection(sectionId) {
    ['inputSection', 'loadingSection', 'errorSection', 'resultsSection'].forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            section.classList.toggle('hidden', id !== sectionId);
        }
    });
}

// Update progress bar
function updateProgress(percent) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `${Math.round(percent)}%`;
}

// Render loading steps
function renderLoadingSteps(steps, currentStep) {
    elements.stepsList.innerHTML = steps.map((step, index) => {
        let statusClass = '';
        let statusIcon = '○';

        if (index < currentStep) {
            statusClass = 'completed';
            statusIcon = '✓';
        } else if (index === currentStep) {
            statusClass = 'active';
            statusIcon = '●';
        }

        return `
      <div class="step ${statusClass}">
        <span class="step-icon">${statusIcon}</span>
        <span class="step-text">${step}</span>
      </div>
    `;
    }).join('');
}

// Render error section
function renderError(error) {
    const errorMessage = typeof error === 'object' ? error.message : error;
    const errorCode = typeof error === 'object' ? error.code : null;
    const errorReason = typeof error === 'object' ? error.reason : null;
    const backendSuggestions = typeof error === 'object' ? (error.suggestions || []) : [];

    const category = getErrorCategory(errorCode);

    elements.errorIcon.textContent = category.icon;
    elements.errorBadge.textContent = category.label;
    elements.errorBadge.className = `error-code-badge severity-${category.severity}`;
    elements.errorCard.className = `error-card error-${category.severity}`;
    elements.errorMessage.textContent = errorMessage;

    if (errorReason) {
        elements.errorReason.textContent = `Technical details: ${errorReason}`;
        elements.errorReason.classList.remove('hidden');
    } else {
        elements.errorReason.classList.add('hidden');
    }

    // Backend suggestions
    if (backendSuggestions.length > 0) {
        elements.suggestionList.innerHTML = backendSuggestions.map(s => `<li>${s}</li>`).join('');
        elements.backendSuggestions.classList.remove('hidden');
    } else {
        elements.backendSuggestions.classList.add('hidden');
    }

    // URL suggestions for not-found errors
    if (errorCode && ['NOT_FOUND', 'PAGE_NOT_FOUND', 'JAVASCRIPT_REQUIRED', 'BOT_PROTECTION'].includes(errorCode)) {
        const urlSuggestions = getSmartUrlSuggestions(state.url);
        if (urlSuggestions.length > 0) {
            elements.urlSuggestionButtons.innerHTML = urlSuggestions.slice(0, 4).map(s => `
        <button class="suggestion-btn" data-url="${s.url}">🔗 ${s.label}</button>
      `).join('');
            elements.urlSuggestions.classList.remove('hidden');

            // Add click handlers
            elements.urlSuggestionButtons.querySelectorAll('.suggestion-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    elements.urlInput.value = btn.dataset.url;
                    state.url = btn.dataset.url;
                    updateUrlTypeIndicator();
                    showSection('inputSection');
                });
            });
        } else {
            elements.urlSuggestions.classList.add('hidden');
        }
    } else {
        elements.urlSuggestions.classList.add('hidden');
    }

    showSection('errorSection');
}

// Get smart URL suggestions
function getSmartUrlSuggestions(inputUrl) {
    if (!inputUrl) return [];

    try {
        const urlObj = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
        const domain = urlObj.hostname;
        const suggestions = [];

        const privacyPaths = ['/privacy', '/privacy-policy', '/legal/privacy'];
        privacyPaths.forEach(path => {
            suggestions.push({
                url: `https://${domain}${path}`,
                label: `${domain}${path}`
            });
        });

        // Special suggestions for known domains
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

// Update URL type indicator
function updateUrlTypeIndicator() {
    const url = elements.urlInput.value;
    if (!url) {
        elements.urlTypeText.textContent = 'Enter a URL to analyze';
        return;
    }

    const urlType = detectUrlType(url);
    if (urlType === 'direct') {
        elements.urlTypeText.textContent = '🔗 Direct privacy policy link detected';
    } else {
        elements.urlTypeText.textContent = '🌐 Website - will search for privacy policy';
    }
}

// Render results
async function renderResults(analysis) {
    if (!analysis) return;

    // Get safe data
    const riskLevel = safeString(analysis.risk_level) || 'Unknown';
    const dataTypes = safeObject(analysis.data_types);
    const warnings = safeArray(analysis.warnings);
    const summary_obj = safeObject(analysis.summary);
    const userRights = safeArray(summary_obj.user_rights);
    const riskFactors = safeArray(analysis.risk_factors);

    // Policy change detection
    try {
        const domain = getDomainFromUrl(state.url);
        const hash = generatePolicyHash(analysis);
        if (hash && domain) {
            const { hasChanged, previousInfo } = await storePolicyHash(domain, hash, analysis);
            const previousData = await checkPolicyChange(domain);
            if (hasChanged && previousData) {
                showPolicyChangeNotification(domain, previousData.riskLevel);
            }
        }
    } catch (e) {
        console.error('Error checking policy change:', e);
    }

    // Count data types
    const dataTypesCount = Object.keys(dataTypes).filter(type => {
        const value = dataTypes[type];
        if (typeof value === 'object' && value !== null) {
            return value.severity > 0 || (value.details && value.details.length > 0);
        }
        return (value || 0) > 0;
    }).length;

    // Update Metrics Dashboard
    const riskIcon = document.getElementById('riskIcon');
    const dataTypesCountEl = document.getElementById('dataTypesCount');
    const warningsCountEl = document.getElementById('warningsCount');
    const rightsCountEl = document.getElementById('rightsCount');

    if (riskIcon) {
        riskIcon.textContent = riskLevel === 'Low' ? '🟢' : riskLevel === 'Medium' ? '🟡' : '🔴';
    }
    if (dataTypesCountEl) dataTypesCountEl.textContent = dataTypesCount;
    if (warningsCountEl) warningsCountEl.textContent = warnings.length;
    if (rightsCountEl) rightsCountEl.textContent = userRights.length;

    // Risk level badges (both in dashboard and card)
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

    // Risk summary from risk factors
    if (riskFactors.length > 0) {
        elements.riskSummary.textContent = riskFactors.slice(0, 2).map(f => safeString(f)).join(' • ');
    } else {
        elements.riskSummary.textContent = '';
    }

    // Render Key Insights
    renderKeyInsights(analysis, dataTypesCount, warnings.length, userRights.length);

    // User friendly summary
    const summary = safeString(analysis.user_friendly_summary);
    if (summary) {
        elements.userSummary.innerHTML = summary;
        elements.summaryCard.classList.remove('hidden');
    } else {
        elements.summaryCard.classList.add('hidden');
    }

    // Data types
    renderDataTypes(dataTypes);
    renderChart(dataTypes);

    // Dark patterns
    renderDarkPatterns(analysis.dark_patterns);

    // Warnings
    renderWarnings(warnings);

    // User rights
    renderUserRights(userRights);

    // Safer alternatives
    renderAlternatives(analysis.safer_alternatives);

    showSection('resultsSection');
}

// Render Key Insights section
function renderKeyInsights(analysis, dataTypesCount, warningsCount, rightsCount) {
    const insightsGrid = document.getElementById('insightsGrid');
    if (!insightsGrid) return;

    const insights = [];
    const riskLevel = safeString(analysis.risk_level);

    // High risk insight
    if (riskLevel === 'High' || riskLevel === 'Critical' || riskLevel === 'Very High') {
        insights.push({
            type: 'critical',
            icon: '🚨',
            title: 'High Privacy Risk',
            text: 'This service has concerning data collection practices. Consider alternatives or limit your data sharing.'
        });
    }

    // Extensive data collection
    if (dataTypesCount > 5) {
        insights.push({
            type: 'warning',
            icon: '📋',
            title: 'Extensive Data Collection',
            text: `They collect ${dataTypesCount} different types of personal data. Review what you're comfortable sharing.`
        });
    }

    // Dark patterns detected
    if (analysis.dark_patterns && analysis.dark_patterns.detected) {
        insights.push({
            type: 'critical',
            icon: '⚠️',
            title: 'Dark Patterns Detected',
            text: `Found ${analysis.dark_patterns.count || 0} manipulative practices that may pressure you into sharing data.`
        });
    }

    // First warning as insight
    const warnings = safeArray(analysis.warnings);
    if (warnings.length > 0 && insights.length < 3) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'Privacy Concern',
            text: safeString(warnings[0])
        });
    }

    // Good rights protection
    if (rightsCount > 3) {
        insights.push({
            type: 'positive',
            icon: '✅',
            title: 'Good Rights Protection',
            text: `You have ${rightsCount} clearly stated privacy rights, including data access and deletion options.`
        });
    }

    // Low risk positive insight
    if (riskLevel === 'Low' && insights.length < 3) {
        insights.push({
            type: 'positive',
            icon: '🛡️',
            title: 'Privacy-Friendly',
            text: 'This service appears to have reasonable data collection practices relative to similar services.'
        });
    }

    // Render insights
    if (insights.length === 0) {
        insightsGrid.innerHTML = '<p class="no-data">Analysis complete. Review the detailed sections below.</p>';
        return;
    }

    insightsGrid.innerHTML = insights.slice(0, 4).map(insight => `
        <div class="insight-item ${insight.type}">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-content">
                <h4>${insight.title}</h4>
                <p>${insight.text}</p>
            </div>
        </div>
    `).join('');
}

// Render data types list
function renderDataTypes(dataTypes) {
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
            ? typeData.details.join(', ')
            : getDataTypeSummary(type);

        return `
            <div class="data-type-item">
                <div class="data-type-icon">${icon}</div>
                <div class="data-type-content">
                    <span class="data-type-label">${label}</span>
                    <span class="data-type-details">${details}</span>
                </div>
                <span class="data-type-risk">${riskIndicator}</span>
            </div>
        `;
    }).join('');
}

// Render chart
function renderChart(dataTypes) {
    const canvas = document.getElementById('dataChart');
    if (!canvas) return;

    // Destroy existing chart
    if (state.chart) {
        state.chart.destroy();
    }

    const types = Object.keys(dataTypes).filter(type => {
        if (!type || typeof type !== 'string') return false;
        const value = dataTypes[type];
        if (typeof value === 'object' && value !== null) {
            return value.severity > 0;
        }
        return (value || 0) > 0;
    });

    if (types.length === 0) {
        canvas.style.display = 'none';
        elements.chartLegend.innerHTML = '<p class="no-data">No data to display</p>';
        return;
    }

    canvas.style.display = 'block';

    const labels = types.map(t => getFriendlyLabel(t));
    const weights = types.map(t => getDataTypeWeight(t));
    const colors = types.map((_, i) => chartColors[i % chartColors.length]);

    const ctx = canvas.getContext('2d');
    state.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: weights,
                backgroundColor: colors,
                borderColor: '#1a1a1a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    cornerRadius: 8
                }
            },
            cutout: '60%'
        }
    });

    // Render custom legend with expand functionality
    const initialItems = 8;
    const hasMore = types.length > initialItems;

    // Store types and colors for expand toggle
    state.legendTypes = types;
    state.legendColors = colors;
    state.legendExpanded = false;

    renderLegendItems(types.slice(0, initialItems), colors.slice(0, initialItems), hasMore ? types.length - initialItems : 0);
}

// Render legend items helper function
function renderLegendItems(types, colors, moreCount) {
    elements.chartLegend.innerHTML = types.map((type, i) => `
        <div class="legend-item">
            <span class="legend-color" style="background-color: ${colors[i]}"></span>
            <span class="legend-label">${getDataTypeIcon(type)} ${getFriendlyLabel(type)}</span>
        </div>
    `).join('');

    if (moreCount > 0) {
        elements.chartLegend.innerHTML += `
            <button class="legend-item legend-more" id="legendExpandBtn" type="button">
                +${moreCount} more
            </button>
        `;

        // Add click event listener
        setTimeout(() => {
            const expandBtn = document.getElementById('legendExpandBtn');
            if (expandBtn) {
                expandBtn.addEventListener('click', toggleLegendExpand);
            }
        }, 0);
    }
}

// Toggle legend expand/collapse
function toggleLegendExpand() {
    if (!state.legendTypes || !state.legendColors) return;

    state.legendExpanded = !state.legendExpanded;

    if (state.legendExpanded) {
        // Show all items
        elements.chartLegend.innerHTML = state.legendTypes.map((type, i) => `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${state.legendColors[i]}"></span>
                <span class="legend-label">${getDataTypeIcon(type)} ${getFriendlyLabel(type)}</span>
            </div>
        `).join('');

        // Add collapse button
        elements.chartLegend.innerHTML += `
            <button class="legend-item legend-more legend-collapse" id="legendCollapseBtn" type="button">
                Show less
            </button>
        `;

        setTimeout(() => {
            const collapseBtn = document.getElementById('legendCollapseBtn');
            if (collapseBtn) {
                collapseBtn.addEventListener('click', toggleLegendExpand);
            }
        }, 0);
    } else {
        // Show limited items again
        const initialItems = 8;
        const moreCount = state.legendTypes.length - initialItems;
        renderLegendItems(state.legendTypes.slice(0, initialItems), state.legendColors.slice(0, initialItems), moreCount);
    }
}

// Render dark patterns
function renderDarkPatterns(darkPatterns) {
    if (!darkPatterns || !darkPatterns.detected || !darkPatterns.patterns?.length) {
        elements.darkPatternsCard.classList.add('hidden');
        return;
    }

    elements.darkPatternsCard.classList.remove('hidden');

    const severityStyles = {
        critical: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        high: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
        medium: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
        low: { bg: '#f7fee7', color: '#65a30d', border: '#bef264' }
    };

    const severity = darkPatterns.severity || 'medium';
    const style = severityStyles[severity] || severityStyles.medium;

    elements.darkPatternsSeverity.textContent = severity.toUpperCase();
    elements.darkPatternsSeverity.style.backgroundColor = style.bg;
    elements.darkPatternsSeverity.style.color = style.color;
    elements.darkPatternsSeverity.style.borderColor = style.border;

    elements.darkPatternsCount.textContent = `Found ${darkPatterns.count} concerning practice${darkPatterns.count > 1 ? 's' : ''}`;

    elements.darkPatternsList.innerHTML = darkPatterns.patterns.map(pattern => {
        const pStyle = severityStyles[pattern.severity] || severityStyles.medium;
        return `
      <div class="dark-pattern-card" style="border-left-color: ${pStyle.color}">
        <div class="pattern-header">
          <span class="pattern-title">${pattern.title}</span>
          <span class="pattern-severity" style="background-color: ${pStyle.bg}; color: ${pStyle.color}">${pattern.severity}</span>
        </div>
        <p class="pattern-description">${pattern.description}</p>
        ${pattern.examples?.length ? `
          <div class="pattern-examples">
            <span class="examples-label">Found:</span>
            ${pattern.examples.map(ex => `<span class="example-tag">${ex}</span>`).join('')}
          </div>
        ` : ''}
        ${pattern.recommendation ? `
          <div class="pattern-recommendation">
            <span class="recommendation-icon">💡</span>
            <span>${pattern.recommendation}</span>
          </div>
        ` : ''}
      </div>
    `;
    }).join('');
}

// Render warnings
function renderWarnings(warnings) {
    if (!warnings || warnings.length === 0) {
        elements.warningsCard.classList.add('hidden');
        return;
    }

    elements.warningsCard.classList.remove('hidden');
    elements.warningsList.innerHTML = warnings.map(warning => {
        const text = safeString(warning);
        return text ? `<div class="warning-item"><span class="warning-icon">⚠️</span><span>${text}</span></div>` : '';
    }).filter(Boolean).join('');
}

// Render user rights
function renderUserRights(rights) {
    if (!rights || rights.length === 0) {
        elements.rightsCard.classList.add('hidden');
        return;
    }

    elements.rightsCard.classList.remove('hidden');
    elements.rightsList.innerHTML = rights.map(right => {
        const text = safeString(right);
        return text ? `<div class="right-item"><span class="right-icon">✓</span><span>${text}</span></div>` : '';
    }).filter(Boolean).join('');
}

// Render safer alternatives
function renderAlternatives(alternatives) {
    if (!alternatives || !alternatives.alternatives || alternatives.alternatives.length === 0) {
        elements.alternativesCard.classList.add('hidden');
        return;
    }

    elements.alternativesCard.classList.remove('hidden');
    elements.alternativesList.innerHTML = alternatives.alternatives.map(alt => `
    <div class="alternative-item">
      <div class="alt-header">
        <span class="alt-name">${alt.name}</span>
        ${alt.privacy_score ? `<span class="alt-score">${alt.privacy_score}/10</span>` : ''}
      </div>
      <p class="alt-description">${alt.description || ''}</p>
      ${alt.pros?.length ? `
        <div class="alt-pros">
          ${alt.pros.slice(0, 3).map(p => `<span class="pro-tag">✓ ${p}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

// ============================================
// API Functions
// ============================================

// Main analysis function
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

    // Update state
    state.url = processedUrl;
    state.loading = true;
    state.error = null;
    state.analysis = null;
    state.progress = 0;
    state.currentStep = 0;

    const urlType = detectUrlType(processedUrl);
    state.analysisType = urlType;

    // Update UI
    elements.urlInput.value = processedUrl;
    elements.analyzeBtn.disabled = true;
    elements.analyzeBtn.innerHTML = '<div class="spinner"></div><span>Analyzing...</span>';

    // Show loading
    const steps = urlType === 'direct' ? directSteps : websiteSteps;
    renderLoadingSteps(steps, 0);
    showSection('loadingSection');

    // Start progress simulation
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

        let endpoint, requestBody;

        if (urlType === 'direct') {
            endpoint = `${BACKEND_URL}/analyze-direct-policy`;
            requestBody = { url: processedUrl };
        } else {
            endpoint = `${BACKEND_URL}/fetch-privacy-policy`;
            requestBody = { url: processedUrl };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
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

        // Handle response
        console.log('Backend response:', result);

        if (urlType === 'direct') {
            state.analysis = result;
        } else {
            // Website scanner returns policy text, need to analyze
            // The backend /fetch-privacy-policy returns policy_text, we need to analyze it
            if (result.policy_text) {
                console.log('Received policy_text, calling /analyze-policy...');
                // Need to call analyze-policy endpoint
                const analysisResponse = await fetch(`${BACKEND_URL}/analyze-policy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        policy_text: result.policy_text,
                        website_url: processedUrl
                    })
                });

                if (!analysisResponse.ok) {
                    console.error('Analysis response not ok:', analysisResponse.status);
                    throw { message: 'Failed to analyze policy content', code: 'ANALYSIS_ERROR' };
                }

                const analysisResult = await analysisResponse.json();
                console.log('Analysis result:', analysisResult);
                state.analysis = analysisResult;
            } else if (result.analysis) {
                // Some endpoints might return analysis directly
                state.analysis = result.analysis;
            } else {
                // Fallback - use the result as-is if it has the expected structure
                console.log('Using result directly:', result);
                state.analysis = result;
            }
        }

        // Complete progress
        clearInterval(progressInterval);
        clearInterval(stepInterval);
        updateProgress(100);
        renderLoadingSteps(steps, steps.length);

        // Show results after brief delay
        console.log('Final analysis to render:', state.analysis);
        setTimeout(() => {
            renderResults(state.analysis);
        }, 500);

    } catch (err) {
        clearInterval(progressInterval);
        clearInterval(stepInterval);

        console.error('Analysis error:', err);

        if (err.name === 'AbortError') {
            renderError({ message: 'Request timed out. The website may be slow to respond.', code: 'TIMEOUT' });
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
// Chrome API Functions
// ============================================

// Get current tab URL
async function getCurrentTabUrl() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            // Filter out chrome:// and extension URLs
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

// Get domain from URL
function getDomainFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return url;
    }
}

// ============================================
// Blocking UI Functions
// ============================================

// Blocking UI Elements
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

// Reset all blocking stats
async function resetBlockingStats() {
    try {
        await chrome.runtime.sendMessage({ type: 'RESET_STATS' });

        // Clear UI immediately
        blockingElements.blockedCount.textContent = '0';
        blockingElements.analyticsCount.textContent = '0';
        blockingElements.advertisingCount.textContent = '0';
        blockingElements.socialCount.textContent = '0';
        blockingElements.marketingCount.textContent = '0';
        blockingElements.fingerprintingCount.textContent = '0';
        blockingElements.trackersContainer.innerHTML = '';
        blockingElements.trackersEmpty.classList.remove('hidden');

        // Brief visual feedback
        blockingElements.resetStatsBtn.textContent = '✓';
        setTimeout(() => {
            blockingElements.resetStatsBtn.textContent = '🗑️';
        }, 1000);
    } catch (error) {
        console.error('Error resetting stats:', error);
    }
}

// Render blocked trackers list
function renderBlockedTrackers(blockedDomains) {
    if (!blockedDomains || Object.keys(blockedDomains).length === 0) {
        blockingElements.trackersEmpty.classList.remove('hidden');
        blockingElements.trackersContainer.innerHTML = '';
        return;
    }

    blockingElements.trackersEmpty.classList.add('hidden');

    // Sort domains by count (most blocked first)
    const sortedDomains = Object.entries(blockedDomains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20); // Show top 20

    blockingElements.trackersContainer.innerHTML = sortedDomains.map(([domain, count]) => `
        <div class="tracker-item">
            <span class="tracker-domain" title="${domain}">🚫 ${domain}</span>
            <span class="tracker-count">${count}×</span>
        </div>
    `).join('');
}

// Toggle trackers list visibility
function toggleTrackersList() {
    const isHidden = blockingElements.blockedTrackersList.classList.contains('hidden');

    if (isHidden) {
        blockingElements.blockedTrackersList.classList.remove('hidden');
        blockingElements.expandIcon.classList.add('rotated');
        blockingElements.showTrackersBtn.querySelector('span:first-child').textContent = 'Hide blocked trackers';
    } else {
        blockingElements.blockedTrackersList.classList.add('hidden');
        blockingElements.expandIcon.classList.remove('rotated');
        blockingElements.showTrackersBtn.querySelector('span:first-child').textContent = 'Show blocked trackers';
    }
}

// Update blocking stats display
function updateBlockingStats(stats) {
    if (!stats) return;

    // Animate the count update
    const currentCount = parseInt(blockingElements.blockedCount.textContent) || 0;
    const newCount = stats.totalBlocked || 0;

    if (newCount !== currentCount) {
        blockingElements.blockedCount.textContent = newCount;
        // Add a brief highlight animation
        blockingElements.blockedCount.style.transform = 'scale(1.1)';
        setTimeout(() => {
            blockingElements.blockedCount.style.transform = 'scale(1)';
        }, 200);
    }

    // Update category counts
    const categories = stats.blockedByCategory || {};
    blockingElements.analyticsCount.textContent = categories.analytics || 0;
    blockingElements.advertisingCount.textContent = categories.advertising || 0;
    blockingElements.socialCount.textContent = categories.social || 0;
    blockingElements.marketingCount.textContent = categories.marketing || 0;
    blockingElements.fingerprintingCount.textContent = categories.fingerprinting || 0;

    // Update blocked trackers list
    renderBlockedTrackers(stats.blockedDomains);
}

// Update blocking toggle UI
function updateBlockingToggle(enabled) {
    blockingElements.toggle.checked = enabled;
    if (enabled) {
        blockingElements.shieldIcon.className = 'shield-active';
        blockingElements.shieldIcon.textContent = '🛡️';
    } else {
        blockingElements.shieldIcon.className = 'shield-inactive';
        blockingElements.shieldIcon.textContent = '🛡️';
    }
}

// Handle toggle change
async function handleBlockingToggle() {
    const enabled = blockingElements.toggle.checked;
    updateBlockingToggle(enabled);

    try {
        await chrome.runtime.sendMessage({
            type: 'TOGGLE_BLOCKING',
            enabled: enabled
        });
    } catch (error) {
        console.error('Error toggling blocking:', error);
        // Revert toggle on error
        blockingElements.toggle.checked = !enabled;
        updateBlockingToggle(!enabled);
    }
}

// Fetch initial blocking stats and status
async function initBlockingUI() {
    try {
        // Get blocking status
        const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKING_STATUS' });
        if (statusResponse) {
            updateBlockingToggle(statusResponse.enabled !== false);
        }

        // Get blocking stats
        const statsResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKING_STATS' });
        if (statsResponse && statsResponse.stats) {
            updateBlockingStats(statsResponse.stats);
        }
    } catch (error) {
        console.error('Error initializing blocking UI:', error);
    }
}

// ============================================
// Event Listeners
// ============================================

// Blocking toggle
if (blockingElements.toggle) {
    blockingElements.toggle.addEventListener('change', handleBlockingToggle);
}

// Show/hide blocked trackers list
if (blockingElements.showTrackersBtn) {
    blockingElements.showTrackersBtn.addEventListener('click', toggleTrackersList);
}

// Reset stats button
if (blockingElements.resetStatsBtn) {
    blockingElements.resetStatsBtn.addEventListener('click', resetBlockingStats);
}

// Form submit
elements.urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    analyzePrivacyPolicy();
});

// Clear button
elements.clearBtn.addEventListener('click', () => {
    elements.urlInput.value = '';
    state.url = '';
    updateUrlTypeIndicator();
});

// Policy analysis toggle
const policyToggleBtn = document.getElementById('policyToggleBtn');
const policyContent = document.getElementById('policyContent');
const policyExpandIcon = document.getElementById('policyExpandIcon');

if (policyToggleBtn) {
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

// URL input change
elements.urlInput.addEventListener('input', () => {
    updateUrlTypeIndicator();
});

// Retry button
elements.retryBtn.addEventListener('click', () => {
    showSection('inputSection');
});

// Search Google button
elements.searchGoogleBtn.addEventListener('click', () => {
    try {
        const domain = getDomainFromUrl(state.url);
        window.open(`https://www.google.com/search?q=${encodeURIComponent(domain + ' privacy policy')}`, '_blank');
    } catch {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(state.url + ' privacy policy')}`, '_blank');
    }
});

// New analysis button
elements.newAnalysisBtn.addEventListener('click', () => {
    showSection('inputSection');
    // Refresh current tab URL
    initCurrentTab();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TAB_CHANGED' || message.type === 'URL_CHANGED') {
        if (message.url && !message.url.startsWith('chrome://')) {
            elements.urlInput.value = message.url;
            elements.currentDomain.textContent = getDomainFromUrl(message.url);
            updateUrlTypeIndicator();
        }
    }

    // Handle real-time blocking stats updates
    if (message.type === 'TRACKER_BLOCKED') {
        updateBlockingStats(message.stats);
    }
});

// ============================================
// Initialization
// ============================================

async function initCurrentTab() {
    const currentUrl = await getCurrentTabUrl();
    if (currentUrl) {
        elements.urlInput.value = currentUrl;
        elements.currentDomain.textContent = getDomainFromUrl(currentUrl);
        updateUrlTypeIndicator();
    } else {
        elements.currentDomain.textContent = 'No website detected';
        elements.urlTypeText.textContent = 'Enter a URL to analyze';
    }
}

// Initialize all UI components
async function init() {
    await initCurrentTab();
    await initBlockingUI();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    init();
});

// Also try to initialize immediately (in case DOMContentLoaded already fired)
if (document.readyState !== 'loading') {
    init();
}
