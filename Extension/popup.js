// Privacy Browser - Popup Script

// DOM Elements
const elements = {
    // Quick stats
    qsTrackers: document.getElementById('qsTrackers'),
    qsCookies: document.getElementById('qsCookies'),
    qsScripts: document.getElementById('qsScripts'),
    qsForms: document.getElementById('qsForms'),
    formSecurityStat: document.getElementById('formSecurityStat'),

    // Feature toggles
    blockingToggle: document.getElementById('blockingToggle'),
    cookieToggle: document.getElementById('cookieToggle'),
    formToggle: document.getElementById('formToggle'),
    adBlockToggle: document.getElementById('adBlockToggle'),

    // Page security
    pageSecuritySection: document.getElementById('pageSecuritySection'),
    securityAlerts: document.getElementById('securityAlerts'),

    // Scripts section
    scriptsToggleBtn: document.getElementById('scriptsToggleBtn'),
    scriptsExpandIcon: document.getElementById('scriptsExpandIcon'),
    scriptsList: document.getElementById('scriptsList'),
    scriptsCount: document.getElementById('scriptsCount'),

    // Trackers section
    trackersToggleBtn: document.getElementById('trackersToggleBtn'),
    trackersExpandIcon: document.getElementById('trackersExpandIcon'),
    trackersList: document.getElementById('trackersList'),
    trackersCount: document.getElementById('trackersCount'),
    trackersContainer: document.getElementById('trackersContainer'),
    trackersEmpty: document.getElementById('trackersEmpty'),
    resetStatsBtn: document.getElementById('resetStatsBtn'),

    // Other
    analyzePolicyBtn: document.getElementById('analyzePolicyBtn'),
    currentDomain: document.getElementById('currentDomain')
};

// Update blocking stats display
function updateBlockingStats(stats) {
    if (!stats) return;

    const total = stats.totalBlocked || 0;
    elements.qsTrackers.textContent = total;
    elements.trackersCount.textContent = total;

    renderBlockedTrackers(stats.blockedDomains);
}

// Render blocked trackers list
function renderBlockedTrackers(blockedDomains) {
    if (!blockedDomains || Object.keys(blockedDomains).length === 0) {
        elements.trackersEmpty.classList.remove('hidden');
        elements.trackersContainer.innerHTML = '';
        return;
    }

    elements.trackersEmpty.classList.add('hidden');

    const sortedDomains = Object.entries(blockedDomains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    elements.trackersContainer.innerHTML = sortedDomains.map(([domain, count]) => `
        <div class="tracker-item">
            <span class="tracker-domain" title="${domain}">🚫 ${domain}</span>
            <span class="tracker-count risk-high">${count}×</span>
        </div>
    `).join('');
}

// Update scripts display
function updateScripts(pageScripts) {
    if (!pageScripts || !pageScripts.scripts) {
        elements.scriptsCount.textContent = '0';
        elements.qsScripts.textContent = '0';
        return;
    }

    const scripts = pageScripts.scripts;
    elements.scriptsCount.textContent = scripts.length;
    elements.qsScripts.textContent = scripts.length;

    if (scripts.length === 0) {
        elements.scriptsList.innerHTML = '<div class="scripts-empty">No third-party scripts detected</div>';
        return;
    }

    elements.scriptsList.innerHTML = scripts.map(script => `
        <div class="script-item">
            <span class="script-domain" title="${script.url}">${script.domain}</span>
            <span class="script-risk risk-${script.risk}">${script.category}</span>
        </div>
    `).join('');
}

// Update form security display
function updateFormSecurity(sensitiveFields) {
    if (!sensitiveFields || !sensitiveFields.fields || sensitiveFields.fields.length === 0) {
        elements.qsForms.textContent = '✓';
        elements.formSecurityStat.classList.remove('warning', 'danger');
        elements.pageSecuritySection.classList.add('hidden');
        return;
    }

    const fields = sensitiveFields.fields;
    const criticalFields = fields.filter(f => f.risk === 'critical');
    const isSecure = sensitiveFields.isSecure;

    // Update quick stat
    if (criticalFields.length > 0 && !isSecure) {
        elements.qsForms.textContent = '⚠️';
        elements.formSecurityStat.classList.add('danger');
    } else if (fields.length > 0) {
        elements.qsForms.textContent = fields.length;
        elements.formSecurityStat.classList.add('warning');
    }

    // Show security alerts
    if (criticalFields.length > 0 || !isSecure) {
        elements.pageSecuritySection.classList.remove('hidden');

        let alerts = [];

        if (!isSecure && criticalFields.length > 0) {
            alerts.push(`<div class="security-alert">🔴 Sensitive data (${criticalFields.map(f => f.label).join(', ')}) on insecure HTTP page!</div>`);
        }

        criticalFields.forEach(field => {
            alerts.push(`<div class="security-alert">⚠️ This page collects ${field.label}</div>`);
        });

        elements.securityAlerts.innerHTML = alerts.join('');
    }
}

// Update cookie stats
function updateCookieStats(cookieStats) {
    if (!cookieStats) return;
    elements.qsCookies.textContent = cookieStats.rejected || 0;
}

// Toggle section visibility
function toggleSection(listEl, iconEl) {
    const isHidden = listEl.classList.contains('hidden');
    if (isHidden) {
        listEl.classList.remove('hidden');
        iconEl.classList.add('rotated');
    } else {
        listEl.classList.add('hidden');
        iconEl.classList.remove('rotated');
    }
}

// Handle feature toggle changes
async function handleToggleChange(feature, enabled) {
    try {
        const { settings } = await chrome.runtime.sendMessage({ type: 'GET_PRIVACY_SETTINGS' });
        settings[feature] = enabled;
        await chrome.runtime.sendMessage({ type: 'SET_PRIVACY_SETTINGS', settings });
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Handle blocking toggle
async function handleBlockingToggle() {
    const enabled = elements.blockingToggle.checked;
    try {
        await chrome.runtime.sendMessage({ type: 'TOGGLE_BLOCKING', enabled });
    } catch (error) {
        console.error('Error toggling blocking:', error);
        elements.blockingToggle.checked = !enabled;
    }
}

// Reset stats
async function resetStats() {
    try {
        await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
        elements.qsTrackers.textContent = '0';
        elements.trackersCount.textContent = '0';
        elements.trackersContainer.innerHTML = '';
        elements.trackersEmpty.classList.remove('hidden');

        elements.resetStatsBtn.textContent = '✓ Reset';
        setTimeout(() => {
            elements.resetStatsBtn.textContent = '🗑️ Reset Stats';
        }, 1000);
    } catch (error) {
        console.error('Error resetting stats:', error);
    }
}

// Open sidepanel for policy analysis
async function openPolicyAnalysis() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.sidePanel.open({ tabId: tab.id });
        window.close();
    } catch (error) {
        console.error('Error opening sidepanel:', error);
    }
}

// Get current domain
async function getCurrentDomain() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            const url = new URL(tab.url);
            elements.currentDomain.textContent = url.hostname || 'Unknown';
        }
    } catch (error) {
        elements.currentDomain.textContent = 'Unknown';
    }
}

// Load settings and update toggles
async function loadSettings() {
    try {
        const { settings } = await chrome.runtime.sendMessage({ type: 'GET_PRIVACY_SETTINGS' });
        elements.cookieToggle.checked = settings.autoRejectCookies !== false;
        elements.formToggle.checked = settings.scanForms !== false;
        elements.adBlockToggle.checked = settings.blockAds !== false;

        const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKING_STATUS' });
        elements.blockingToggle.checked = statusResponse.enabled !== false;
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Initialize popup
async function init() {
    // Get current domain
    getCurrentDomain();

    // Load settings
    loadSettings();

    // Get blocking stats
    try {
        const statsResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKING_STATS' });
        if (statsResponse && statsResponse.stats) {
            updateBlockingStats(statsResponse.stats);
        }
    } catch (error) {
        console.error('Error getting blocking stats:', error);
    }

    // Get page security info
    try {
        const securityInfo = await chrome.runtime.sendMessage({ type: 'GET_PAGE_SECURITY' });
        if (securityInfo) {
            updateScripts(securityInfo.pageScripts);
            updateFormSecurity(securityInfo.sensitiveFields);
            updateCookieStats(securityInfo.cookieStats);
        }
    } catch (error) {
        console.error('Error getting page security:', error);
    }
}

// Event Listeners
elements.blockingToggle.addEventListener('change', handleBlockingToggle);
elements.cookieToggle.addEventListener('change', () => handleToggleChange('autoRejectCookies', elements.cookieToggle.checked));
elements.formToggle.addEventListener('change', () => handleToggleChange('scanForms', elements.formToggle.checked));
elements.adBlockToggle.addEventListener('change', () => handleToggleChange('blockAds', elements.adBlockToggle.checked));

elements.scriptsToggleBtn.addEventListener('click', () => toggleSection(elements.scriptsList, elements.scriptsExpandIcon));
elements.trackersToggleBtn.addEventListener('click', () => toggleSection(elements.trackersList, elements.trackersExpandIcon));

elements.resetStatsBtn.addEventListener('click', resetStats);
elements.analyzePolicyBtn.addEventListener('click', openPolicyAnalysis);

// Listen for real-time updates
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TRACKER_BLOCKED') {
        updateBlockingStats(message.stats);
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
