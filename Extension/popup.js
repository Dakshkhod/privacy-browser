// Poliscope - Popup Script

// HTML-escape utility for safe interpolation into innerHTML.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

// DOM Elements
const elements = {
    qsTrackers: document.getElementById('qsTrackers'),
    qsCookies: document.getElementById('qsCookies'),
    qsScripts: document.getElementById('qsScripts'),
    qsForms: document.getElementById('qsForms'),
    formSecurityStat: document.getElementById('formSecurityStat'),

    blockingToggle: document.getElementById('blockingToggle'),
    cookieToggle: document.getElementById('cookieToggle'),
    formToggle: document.getElementById('formToggle'),
    adBlockToggle: document.getElementById('adBlockToggle'),

    pageSecuritySection: document.getElementById('pageSecuritySection'),
    securityAlerts: document.getElementById('securityAlerts'),

    scriptsToggleBtn: document.getElementById('scriptsToggleBtn'),
    scriptsExpandIcon: document.getElementById('scriptsExpandIcon'),
    scriptsList: document.getElementById('scriptsList'),
    scriptsCount: document.getElementById('scriptsCount'),

    trackersToggleBtn: document.getElementById('trackersToggleBtn'),
    trackersExpandIcon: document.getElementById('trackersExpandIcon'),
    trackersList: document.getElementById('trackersList'),
    trackersCount: document.getElementById('trackersCount'),
    trackersContainer: document.getElementById('trackersContainer'),
    trackersEmpty: document.getElementById('trackersEmpty'),
    resetStatsBtn: document.getElementById('resetStatsBtn'),

    analyzePolicyBtn: document.getElementById('analyzePolicyBtn'),
    currentDomain: document.getElementById('currentDomain')
};

function updateBlockingStats(stats) {
    if (!stats) return;
    const total = stats.totalBlocked || 0;
    if (elements.qsTrackers) elements.qsTrackers.textContent = total;
    if (elements.trackersCount) elements.trackersCount.textContent = total;
    renderBlockedTrackers(stats.blockedDomains);
}

function renderBlockedTrackers(blockedDomains) {
    if (!elements.trackersContainer || !elements.trackersEmpty) return;
    if (!blockedDomains || Object.keys(blockedDomains).length === 0) {
        elements.trackersEmpty.classList.remove('hidden');
        elements.trackersContainer.replaceChildren();
        return;
    }
    elements.trackersEmpty.classList.add('hidden');
    const sorted = Object.entries(blockedDomains).sort((a, b) => b[1] - a[1]).slice(0, 15);
    elements.trackersContainer.innerHTML = sorted.map(([domain, count]) => `
        <div class="tracker-item">
            <span class="tracker-domain" title="${esc(domain)}">🚫 ${esc(domain)}</span>
            <span class="tracker-count risk-high">${esc(count)}×</span>
        </div>
    `).join('');
}

function updateScripts(pageScripts) {
    if (!elements.scriptsList) return;
    if (!pageScripts || !pageScripts.scripts) {
        if (elements.scriptsCount) elements.scriptsCount.textContent = '0';
        if (elements.qsScripts) elements.qsScripts.textContent = '0';
        return;
    }
    const scripts = pageScripts.scripts;
    if (elements.scriptsCount) elements.scriptsCount.textContent = scripts.length;
    if (elements.qsScripts) elements.qsScripts.textContent = scripts.length;

    if (scripts.length === 0) {
        elements.scriptsList.innerHTML = '<div class="scripts-empty">No third-party scripts detected</div>';
        return;
    }
    elements.scriptsList.innerHTML = scripts.map(script => `
        <div class="script-item">
            <span class="script-domain" title="${esc(script.url)}">${esc(script.domain)}</span>
            <span class="script-risk risk-${esc(script.risk)}">${esc(script.category)}</span>
        </div>
    `).join('');
}

function updateFormSecurity(sensitiveFields) {
    if (!elements.qsForms || !elements.formSecurityStat || !elements.pageSecuritySection) return;
    if (!sensitiveFields || !sensitiveFields.fields || sensitiveFields.fields.length === 0) {
        elements.qsForms.textContent = '✓';
        elements.formSecurityStat.classList.remove('warning', 'danger');
        elements.pageSecuritySection.classList.add('hidden');
        return;
    }
    const fields = sensitiveFields.fields;
    const criticalFields = fields.filter(f => f.risk === 'critical');
    const isSecure = !!sensitiveFields.isSecure;

    if (criticalFields.length > 0 && !isSecure) {
        elements.qsForms.textContent = '⚠️';
        elements.formSecurityStat.classList.add('danger');
    } else if (fields.length > 0) {
        elements.qsForms.textContent = String(fields.length);
        elements.formSecurityStat.classList.add('warning');
    }

    if (criticalFields.length > 0 || !isSecure) {
        elements.pageSecuritySection.classList.remove('hidden');
        const alerts = [];
        if (!isSecure && criticalFields.length > 0) {
            alerts.push(
                `<div class="security-alert">🔴 Sensitive data (${esc(criticalFields.map(f => f.label).join(', '))}) on insecure HTTP page!</div>`
            );
        }
        criticalFields.forEach(field => {
            alerts.push(`<div class="security-alert">⚠️ This page collects ${esc(field.label)}</div>`);
        });
        elements.securityAlerts.innerHTML = alerts.join('');
    }
}

function updateCookieStats(cookieStats) {
    if (!cookieStats || !elements.qsCookies) return;
    elements.qsCookies.textContent = cookieStats.rejected || 0;
}

function toggleSection(listEl, iconEl) {
    if (!listEl || !iconEl) return;
    const isHidden = listEl.classList.contains('hidden');
    if (isHidden) {
        listEl.classList.remove('hidden');
        iconEl.classList.add('rotated');
    } else {
        listEl.classList.add('hidden');
        iconEl.classList.remove('rotated');
    }
}

async function handleToggleChange(feature, enabled) {
    try {
        const resp = await chrome.runtime.sendMessage({ type: 'GET_PRIVACY_SETTINGS' });
        const settings = (resp && resp.settings) || {};
        settings[feature] = enabled;
        await chrome.runtime.sendMessage({ type: 'SET_PRIVACY_SETTINGS', settings });
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

async function handleBlockingToggle() {
    const enabled = elements.blockingToggle.checked;
    try {
        await chrome.runtime.sendMessage({ type: 'TOGGLE_BLOCKING', enabled });
    } catch (error) {
        console.error('Error toggling blocking:', error);
        elements.blockingToggle.checked = !enabled;
    }
}

async function resetStats() {
    try {
        await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
        if (elements.qsTrackers) elements.qsTrackers.textContent = '0';
        if (elements.trackersCount) elements.trackersCount.textContent = '0';
        if (elements.trackersContainer) elements.trackersContainer.replaceChildren();
        if (elements.trackersEmpty) elements.trackersEmpty.classList.remove('hidden');

        if (elements.resetStatsBtn) {
            elements.resetStatsBtn.textContent = '✓ Reset';
            setTimeout(() => {
                if (elements.resetStatsBtn) elements.resetStatsBtn.textContent = '🗑️ Reset Stats';
            }, 1000);
        }
    } catch (error) {
        console.error('Error resetting stats:', error);
    }
}

// Open sidepanel for policy analysis.
// IMPORTANT: chrome.sidePanel.open() requires a synchronous user-gesture frame.
// We must NOT `await` before calling it. Use windowId rather than tabId so we
// don't need to query tabs first.
function openPolicyAnalysis() {
    try {
        chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    } catch (e) {
        // Fallback to tab-based open if windowId fails on older Chrome.
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                try { chrome.sidePanel.open({ tabId: tabs[0].id }); } catch (_) {}
            }
        });
    }
    setTimeout(() => window.close(), 50);
}

async function getCurrentDomain() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            try {
                const url = new URL(tab.url);
                if (elements.currentDomain) elements.currentDomain.textContent = url.hostname || 'Unknown';
            } catch (_) {
                if (elements.currentDomain) elements.currentDomain.textContent = 'Unknown';
            }
        }
    } catch (_) {
        if (elements.currentDomain) elements.currentDomain.textContent = 'Unknown';
    }
}

async function loadSettings() {
    try {
        const resp = await chrome.runtime.sendMessage({ type: 'GET_PRIVACY_SETTINGS' });
        const settings = (resp && resp.settings) || {};
        if (elements.cookieToggle) elements.cookieToggle.checked = settings.autoRejectCookies !== false;
        if (elements.formToggle) elements.formToggle.checked = settings.scanForms !== false;
        if (elements.adBlockToggle) elements.adBlockToggle.checked = settings.blockAds !== false;

        const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKING_STATUS' });
        if (elements.blockingToggle) {
            elements.blockingToggle.checked = !!(statusResponse && statusResponse.enabled !== false);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function init() {
    getCurrentDomain();
    loadSettings();
    try {
        const statsResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKING_STATS' });
        if (statsResponse && statsResponse.stats) updateBlockingStats(statsResponse.stats);
    } catch (error) {
        console.error('Error getting blocking stats:', error);
    }
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
if (elements.blockingToggle) elements.blockingToggle.addEventListener('change', handleBlockingToggle);
if (elements.cookieToggle) elements.cookieToggle.addEventListener('change', () => handleToggleChange('autoRejectCookies', elements.cookieToggle.checked));
if (elements.formToggle) elements.formToggle.addEventListener('change', () => handleToggleChange('scanForms', elements.formToggle.checked));
if (elements.adBlockToggle) elements.adBlockToggle.addEventListener('change', () => handleToggleChange('blockAds', elements.adBlockToggle.checked));

if (elements.scriptsToggleBtn) elements.scriptsToggleBtn.addEventListener('click', () => toggleSection(elements.scriptsList, elements.scriptsExpandIcon));
if (elements.trackersToggleBtn) elements.trackersToggleBtn.addEventListener('click', () => toggleSection(elements.trackersList, elements.trackersExpandIcon));

if (elements.resetStatsBtn) elements.resetStatsBtn.addEventListener('click', resetStats);
if (elements.analyzePolicyBtn) elements.analyzePolicyBtn.addEventListener('click', openPolicyAnalysis);

chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'TRACKER_BLOCKED') {
        updateBlockingStats(message.stats);
    }
});

document.addEventListener('DOMContentLoaded', init);
