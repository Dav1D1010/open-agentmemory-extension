// =============================================================================
// Open AgentMemory — Service Worker
// Central message router between content scripts, popup, and the agentmemory API.
// =============================================================================

const DEFAULT_API_URL = 'http://localhost:3111';

let _badgeCount = 0;
let _isConnected = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSettings() {
  const defaults = {
    apiUrl: DEFAULT_API_URL,
    geminiAutoSave: true,
    chatgptAutoSave: true,
    claudeAutoSave: true,
    grokAutoSave: true,
    geminiAutoSearch: false,
    chatgptAutoSearch: false,
    claudeAutoSearch: false,
    grokAutoSearch: false,
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  return { ...defaults, ...stored };
}

function authHeaders(secret) {
  const h = { 'Content-Type': 'application/json' };
  if (secret) h['Authorization'] = `Bearer ${secret}`;
  return h;
}

async function apiPost(endpoint, body) {
  const settings = await getSettings();
  const url = `${settings.apiUrl}/agentmemory/${endpoint}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(settings.secret),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json().catch(() => ({}));
  } catch (err) {
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

async function updateBadge() {
  const settings = await getSettings();
  try {
    const res = await fetch(`${settings.apiUrl}/agentmemory/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '_badge_ping', limit: 1 }),
      signal: AbortSignal.timeout(3000),
    });
    _isConnected = res.ok;
  } catch {
    _isConnected = false;
  }

  if (!_isConnected) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else if (_badgeCount > 0) {
    chrome.action.setBadgeText({ text: String(_badgeCount) });
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
            cwd: '/home/david',
            timestamp: new Date().toISOString(),
            data: { prompt: message.content },
          });
          sendResponse(result);
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
            cwd: '/home/david',
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
          const url = `${settings.apiUrl}/agentmemory/search`;
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: '_status_ping', limit: 1 }),
              signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
              sendResponse({ connected: true, apiUrl: settings.apiUrl });
            } else {
              throw new Error('Bad response');
            }
          } catch {
            sendResponse({ connected: false, apiUrl: settings.apiUrl });
          }
          return;
        }

        // -- Get/set settings --
        case 'GET_SETTINGS': {
          const settings = await getSettings();
          sendResponse(settings);
          return;
        }

        case 'SET_SETTINGS': {
          await chrome.storage.local.set(message.settings);
          sendResponse({ ok: true });
          return;
        }

        // -- Queue Count (for Badge) --
        case 'SET_QUEUE_COUNT': {
          _badgeCount = message.count || 0;
          updateBadge();
          sendResponse({ ok: true });
          return;
        }

        case 'CONTEXT_SENT': {
          _badgeCount = 0;
          updateBadge();
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'statusCheck') updateBadge();
});
