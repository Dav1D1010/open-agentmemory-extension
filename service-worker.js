// =============================================================================
// Open AgentMemory — Service Worker
// Central message router between content scripts, popup, and the agentmemory API.
// =============================================================================

const DEFAULT_API_URL = 'http://localhost:3111';
let _isConnected = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSettings() {
  const defaults = {
    apiUrl: DEFAULT_API_URL,
    secret: '',
    geminiAutoSave: true,
    chatgptAutoSave: true,
    claudeAutoSave: true,
    grokAutoSave: true,
    showNotifications: false,
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  return { ...defaults, ...stored };
}

function normalizeApiUrl(value) {
  const url = new URL(String(value || '').trim());
  const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (url.protocol !== 'http:' || !isLoopback || url.username || url.password) {
    throw new Error('AgentMemory URL must be an http://localhost or http://127.0.0.1 address');
  }

  return url.origin;
}

function authHeaders(secret) {
  const h = { 'Content-Type': 'application/json' };
  if (secret) h['Authorization'] = `Bearer ${secret}`;
  return h;
}

async function apiRequest(endpoint, { method = 'POST', body, timeout = 10000 } = {}) {
  const settings = await getSettings();
  let apiUrl;

  try {
    apiUrl = normalizeApiUrl(settings.apiUrl);
  } catch (err) {
    return { error: err.message };
  }

  try {
    const res = await fetch(`${apiUrl}/agentmemory/${endpoint}`, {
      method,
      headers: authHeaders(settings.secret),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: payload.error || `AgentMemory returned HTTP ${res.status}`, status: res.status };
    }
    return payload;
  } catch (err) {
    return { error: err.message };
  }
}

async function apiPost(endpoint, body) {
  return apiRequest(endpoint, { body });
}

async function getQueueCount() {
  const stored = await chrome.storage.session.get('oamQueueCount');
  return Number.isInteger(stored.oamQueueCount) ? stored.oamQueueCount : 0;
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

async function updateBadge() {
  const [health, badgeCount] = await Promise.all([
    apiRequest('health', { method: 'GET', timeout: 3000 }),
    getQueueCount(),
  ]);
  _isConnected = !health.error;

  if (!_isConnected) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else if (badgeCount > 0) {
    chrome.action.setBadgeText({ text: String(badgeCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }); // Indigo for queued items
  } else {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        // -- Observe: save a conversation turn to memory --
        case 'OBSERVE': {
          const settings = await getSettings();
          const platform = message.platform || 'unknown';

          if (platform === 'gemini' && !settings.geminiAutoSave) { sendResponse({ skipped: true }); return; }
          if (platform === 'chatgpt' && !settings.chatgptAutoSave) { sendResponse({ skipped: true }); return; }
          if (platform === 'claude' && !settings.claudeAutoSave) { sendResponse({ skipped: true }); return; }
          if (platform === 'grok' && !settings.grokAutoSave) { sendResponse({ skipped: true }); return; }

          const result = await apiPost('observe', {
            hookType: 'prompt_submit',
            sessionId: message.sessionId || `web_${platform}_${Date.now().toString(36)}`,
            project: `${platform}-web`,
            cwd: `browser:${platform}`,
            timestamp: new Date().toISOString(),
            data: { prompt: message.content },
          });
          sendResponse({ ...result, showToast: settings.showNotifications });
          return;
        }

        // -- Search: recall relevant memories --
        case 'SEARCH': {
          const result = await apiPost('search', {
            query: message.query,
            limit: message.limit || 3,
          });
          sendResponse(result);
          return;
        }

        // -- Session lifecycle --
        case 'SESSION_START': {
          const result = await apiPost('session/start', {
            sessionId: message.sessionId,
            project: message.project || `${message.platform}-web`,
            cwd: `browser:${message.platform || 'unknown'}`,
          });
          sendResponse(result);
          return;
        }

        case 'SESSION_END': {
          const result = await apiPost('session/end', { sessionId: message.sessionId });
          sendResponse(result);
          return;
        }

        // -- Status: health check for popup --
        case 'STATUS': {
          const settings = await getSettings();
          const health = await apiRequest('health', { method: 'GET', timeout: 3000 });
          sendResponse({
            connected: !health.error,
            apiUrl: settings.apiUrl,
            version: health.version,
            error: health.error,
          });
          return;
        }

        // -- Get/set settings --
        case 'GET_SETTINGS': {
          const settings = await getSettings();
          sendResponse(settings);
          return;
        }

        case 'SET_SETTINGS': {
          const next = {};
          const incoming = message.settings || {};
          const booleanKeys = [
            'geminiAutoSave',
            'chatgptAutoSave',
            'claudeAutoSave',
            'grokAutoSave',
            'showNotifications',
          ];

          if ('apiUrl' in incoming) next.apiUrl = normalizeApiUrl(incoming.apiUrl);
          if ('secret' in incoming) next.secret = String(incoming.secret || '').trim();
          for (const key of booleanKeys) {
            if (key in incoming) next[key] = incoming[key] === true;
          }

          await chrome.storage.local.set(next);
          sendResponse({ ok: true, settings: next });
          return;
        }

        // -- Queue Count (for Badge) --
        case 'SET_QUEUE_COUNT': {
          const count = Math.max(0, Number.parseInt(message.count, 10) || 0);
          await chrome.storage.session.set({ oamQueueCount: count });
          await updateBadge();
          sendResponse({ ok: true });
          return;
        }

        case 'CONTEXT_SENT': {
          await chrome.storage.session.remove('oamQueueCount');
          await updateBadge();
          sendResponse({ ok: true });
          return;
        }

        default:
          sendResponse({ error: `Unknown message type: ${message.type}` });
      }
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();
  return true; 
});

// Check connection on install and periodically
chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
  chrome.alarms.create('statusCheck', { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  updateBadge();
  chrome.alarms.create('statusCheck', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'statusCheck') updateBadge();
});
