// =============================================================================
// Open AgentMemory — Gemini Web Content Script
// =============================================================================

/* global OAM */

(() => {
  'use strict';

  OAM.platform = 'gemini';
  OAM.startSession();
  OAM.initQueueListener(); // Start listening for queued context from popup

  // ---------------------------------------------------------------------------
  // Selectors — multiple fallbacks for Gemini's evolving DOM
  // ---------------------------------------------------------------------------

  const CONVERSATION_SELECTORS = [
    '.conversation-container',
    'main',
    '[role="main"]',
  ];

  const USER_MSG_SELECTORS = [
    '.user-query',
    '[data-message-author-role="user"]',
    '.query-text',
  ];

  const AI_MSG_SELECTORS = [
    '.model-response-text',
    '.response-container-content',
    '[data-message-author-role="model"]',
    '.markdown-main-panel',
  ];

  const INPUT_SELECTORS = [
    '.ql-editor[contenteditable]',
    '[contenteditable="true"][aria-label*="message"]',
    '[contenteditable="true"]',
    'textarea',
  ];

  const SEND_BTN_SELECTORS = [
    'button[aria-label="Send message"]',
    '.send-button',
    'button[data-test-id="send-button"]',
    'button[aria-label*="Send"]',
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
  // Send interception — synchronous context prepend
  // ---------------------------------------------------------------------------

  function handleSend() {
    const queued = OAM.getQueuedContext();
    if (!queued) return; // Nothing queued — don't touch the input

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

      // Re-check periodically in case DOM rebuilds
      setTimeout(tryHook, 5000);
    }

    tryHook();
  }

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
