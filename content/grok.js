// =============================================================================
// Open AgentMemory — Grok Web Content Script
// =============================================================================

/* global OAM */

(() => {
  'use strict';

  OAM.platform = 'grok';
  OAM.startSession();
  OAM.initQueueListener();

  // ---------------------------------------------------------------------------
  // Selectors
  // ---------------------------------------------------------------------------

  const CONVERSATION_SELECTORS = [
    'main',
    '.grok-chat',
    '[data-testid="conversation"]',
    'body' // fallback
  ];

  const USER_MSG_SELECTORS = [
    '.user-message',
    '[data-testid="user-message"]',
    '.message.user'
  ];

  const AI_MSG_SELECTORS = [
    '.grok-message',
    '[data-testid="grok-message"]',
    '.message.assistant'
  ];

  const INPUT_SELECTORS = [
    'textarea[placeholder*="Ask Grok"]',
    'textarea',
    '[contenteditable="true"]'
  ];

  const SEND_BTN_SELECTORS = [
    'button[aria-label="Grok"]',
    'button[aria-label*="Send"]',
    'button[type="submit"]'
  ];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function qs(sels) {
    for (const s of sels) { const el = document.querySelector(s); if (el) return el; }
    return null;
  }

  function qsAll(sels) {
    for (const s of sels) { const els = document.querySelectorAll(s); if (els.length) return [...els]; }
    return [];
  }

  function getText(el) { return el ? (el.innerText || el.textContent || '') : ''; }

  // ---------------------------------------------------------------------------
  // Message extraction
  // ---------------------------------------------------------------------------

  function extractMessagePairs() {
    const userMsgs = qsAll(USER_MSG_SELECTORS);
    const aiMsgs = qsAll(AI_MSG_SELECTORS);
    const pairs = [];
    const len = Math.min(userMsgs.length, aiMsgs.length);
    for (let i = 0; i < len; i++) {
      const user = getText(userMsgs[i]).trim();
      const ai = getText(aiMsgs[i]).trim();
      if (user && ai && ai.length > 5) pairs.push({ user, ai });
    }
    return pairs;
  }

  // ---------------------------------------------------------------------------
  // Send interception
  // ---------------------------------------------------------------------------

  function handleSend() {
    const queued = OAM.getQueuedContext();
    if (!queued) return;

    const input = qs(INPUT_SELECTORS);
    if (!input) return;

    OAM.prependContextToInput(input, queued);
    OAM.clearQueuedContext();
    OAM.showToast('📎 Memory context sent with prompt');
  }

  // ---------------------------------------------------------------------------
  // Hook send button and Enter key
  // ---------------------------------------------------------------------------

  function hookSendButton() {
    function tryHook() {
      const btn = qs(SEND_BTN_SELECTORS);
      const input = qs(INPUT_SELECTORS);

      if (!btn && !input) {
        setTimeout(tryHook, 2000);
        return;
      }

      if (btn && !btn._oamHooked) {
        btn._oamHooked = true;
        btn.addEventListener('click', handleSend, { capture: true });
      }

      if (input && !input._oamHooked) {
        input._oamHooked = true;
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) handleSend();
        }, { capture: true });
      }

      setTimeout(tryHook, 5000);
    }
    tryHook();
  }

  // ---------------------------------------------------------------------------
  // Auto-Search Reply Injection
  // ---------------------------------------------------------------------------

  OAM.executeAutoReply = (text) => {
    const input = qs(INPUT_SELECTORS);
    if (!input) return;
    
    OAM.prependContextToInput(input, text, true);
    
    setTimeout(() => {
      const btn = qs(SEND_BTN_SELECTORS);
      if (btn && !btn.disabled) {
        btn.click();
      } else {
        // Fallback: dispatch enter
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      }
    }, 300);
  };

  // ---------------------------------------------------------------------------
  // SPA navigation
  // ---------------------------------------------------------------------------

  function watchNavigation() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(init, 1500);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    const containerSel = CONVERSATION_SELECTORS.find(s => document.querySelector(s)) || CONVERSATION_SELECTORS[0];
    OAM.observeDOM(containerSel, extractMessagePairs);
    hookSendButton();
  }

  setTimeout(() => {
    init();
    watchNavigation();
  }, 2000);
})();
