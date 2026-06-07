// =============================================================================
// Open AgentMemory — Shared Content Script Utilities
// =============================================================================

/* global chrome */

const OAM = (() => {
  const DEBOUNCE_MS = 2000;
  const MAX_CONTENT_LENGTH = 32000;
  const CONTEXT_HEADER = '---\n[AgentMemory Context — selected from past sessions]\n---\n';
  const CONTEXT_FOOTER = '\n---\n[End AgentMemory Context]\n---\n\n';

  let _sessionId = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  let _platform = 'unknown';
  let _observedMessages = new Set();
  let _debounceTimer = null;

  let _showNotifications = true;

  // ---------------------------------------------------------------------------
  // Queued context — synced from chrome.storage.session
  // ---------------------------------------------------------------------------
  let _queuedContext = null;

  function initQueueListener() {
    chrome.storage.session.get('oamQueuedContext', (data) => {
      _queuedContext = data.oamQueuedContext || null;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'session' && 'oamQueuedContext' in changes) {
        _queuedContext = changes.oamQueuedContext.newValue || null;
        if (_queuedContext) {
          showContextBanner(_queuedContext);
        } else {
          removeContextBanner();
        }
      }
      
      // Also listen for settings changes without requiring a page reload
      if (area === 'local') {
        const key = `${_platform}AutoSearch`;
        if (key in changes) {
          _autoSearchEnabled = changes[key].newValue === true;
        }
        if ('showNotifications' in changes) {
          _showNotifications = changes.showNotifications.newValue === true;
        }
      }
    });

    // Load auto-search settings
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (s) => {
      if (s) {
        if (s.showNotifications !== undefined) _showNotifications = s.showNotifications === true;
      }
    });
  }

  function getQueuedContext() {
    return _queuedContext;
  }

  function clearQueuedContext() {
    _queuedContext = null;
    chrome.storage.session.remove('oamQueuedContext');
    removeContextBanner();
    chrome.runtime.sendMessage({ type: 'CONTEXT_SENT' });
  }

  // ---------------------------------------------------------------------------
  // Context banner
  // ---------------------------------------------------------------------------

  function showContextBanner(context) {
    removeContextBanner();
    const lines = context.split('\n').filter(l => l.trim()).length;
    const banner = document.createElement('div');
    banner.id = 'oam-banner';
    Object.assign(banner.style, {
      position: 'fixed', bottom: '80px', right: '20px', zIndex: '999999',
      background: '#181818', border: '1px solid #494949', borderRadius: '8px',
      padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '12px', fontFamily: 'system-ui, sans-serif', color: '#e4e4e7',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)', cursor: 'pointer', userSelect: 'none',
    });
    banner.innerHTML = `
      <span style="font-size:14px">📎</span>
      <span><strong>${lines} line${lines === 1 ? '' : 's'}</strong> of memory queued for next prompt</span>
      <span id="oam-banner-close" style="margin-left:6px;color:#7D7D7D;font-size:14px;line-height:1">×</span>
    `;
    banner.querySelector('#oam-banner-close').addEventListener('click', (e) => {
      e.stopPropagation();
      clearQueuedContext();
    });
    document.body.appendChild(banner);
  }

  function removeContextBanner() {
    const el = document.getElementById('oam-banner');
    if (el) el.remove();
  }

  // ---------------------------------------------------------------------------
  // Input manipulation
  // ---------------------------------------------------------------------------

  function prependContextToInput(inputEl, contextText, isRawAutoReply = false) {
    let fullContext = '';
    
    if (isRawAutoReply) {
      fullContext = contextText + '\n\n';
    } else {
      if (_queuedContext) {
        fullContext += CONTEXT_HEADER + _queuedContext + CONTEXT_FOOTER;
      }
    }

    if (!fullContext) return;

    if (inputEl.tagName === 'TEXTAREA') {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(inputEl, fullContext + inputEl.value);
      } else {
        inputEl.value = fullContext + inputEl.value;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));

    } else if (inputEl.getAttribute('contenteditable') === 'true' || inputEl.classList.contains('ProseMirror')) {
      inputEl.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      const textNode = document.createTextNode(fullContext);
      range.insertNode(textNode);

      range.selectNodeContents(inputEl);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);

      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ---------------------------------------------------------------------------
  // Background messaging
  // ---------------------------------------------------------------------------

  function sendToBackground(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => resolve(response || {}));
      } catch (e) {
        resolve({});
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Auto-save
  // ---------------------------------------------------------------------------

  async function observeConversation(userText, aiText) {
    const fingerprint = hashSimple(userText.slice(0, 200) + aiText.slice(0, 200));
    if (_observedMessages.has(fingerprint)) return;
    _observedMessages.add(fingerprint);

    const content = truncate(`User: ${userText}\n\nAssistant: ${aiText}`, MAX_CONTENT_LENGTH);
    const result = await sendToBackground({
      type: 'OBSERVE', platform: _platform, sessionId: _sessionId, content,
    });

    if (result && !result.error && !result.skipped && result.showToast) {
      showToast('💾 Saved to memory');
    }
  }

  // ---------------------------------------------------------------------------
  // DOM observation
  // ---------------------------------------------------------------------------

  function observeDOM(containerSelector, messageExtractor) {
    function tryAttach() {
      const container = document.querySelector(containerSelector);
      if (!container) {
        setTimeout(tryAttach, 2000);
        return;
      }

      const observer = new MutationObserver(() => {
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => {
          const pairs = messageExtractor();
          for (const pair of pairs) {
            if (pair.user && pair.ai) observeConversation(pair.user, pair.ai);
          }
        }, DEBOUNCE_MS);
      });

      observer.observe(container, { childList: true, subtree: true, characterData: true });

      setTimeout(() => {
        const pairs = messageExtractor();
        for (const pair of pairs) {
          if (pair.user && pair.ai) observeConversation(pair.user, pair.ai);
        }
      }, 3000);
    }
    tryAttach();
  }

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  function showToast(message) {
    if (!_showNotifications) return;

    const existing = document.getElementById('oam-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'oam-toast';
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '24px', right: '24px', padding: '8px 16px',
      borderRadius: '6px', background: '#202020', border: '1px solid #494949',
      color: '#e4e4e7', fontSize: '12px', fontFamily: 'system-ui, sans-serif',
      zIndex: '999999', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', opacity: '0',
      transform: 'translateY(8px)', transition: 'all 0.25s ease', pointerEvents: 'none',
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      toast.style.opacity = '1'; toast.style.transform = 'translateY(0)';
    }));
    setTimeout(() => {
      toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function truncate(str, maxLen) {
    return str.length <= maxLen ? str : str.slice(0, maxLen) + '\n... [truncated]';
  }

  function hashSimple(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0;
    }
    return hash.toString(36);
  }

  function startSession() {
    sendToBackground({
      type: 'SESSION_START', platform: _platform, sessionId: _sessionId, project: `${_platform}-web`,
    });
  }

  return {
    get sessionId() { return _sessionId; },
    set platform(p) { _platform = p; },
    get platform() { return _platform; },

    initQueueListener,
    getQueuedContext,
    clearQueuedContext,
    prependContextToInput,
    sendToBackground,
    observeConversation,
    observeDOM,
    startSession,
    showToast,
    truncate,
    hashSimple,
    executeAutoReply: null, // To be overridden by platform script
  };
})();
