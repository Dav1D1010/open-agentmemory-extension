// =============================================================================
// Open AgentMemory — Popup Logic (v2)
// Tabbed UI: Search, Recent, Settings.
// Manual memory selection → queue → synchronous inject on next prompt send.
// =============================================================================

/* global chrome */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Element refs ────────────────────────────────────────────────────────────
  const statusBadge    = document.getElementById('status-badge');
  const statusText     = document.getElementById('status-text');
  const apiUrlDisplay  = document.getElementById('api-url-display');
  const dashboardLink  = document.getElementById('dashboard-link');
  const queueBanner    = document.getElementById('queue-banner');
  const queueLabel     = document.getElementById('queue-label');
  const queueClearBtn  = document.getElementById('queue-clear-btn');
  const searchInput    = document.getElementById('search-input');
  const searchBtn      = document.getElementById('search-btn');
  const searchResults  = document.getElementById('search-results');
  const recentResults  = document.getElementById('recent-results');
  const geminiSave     = document.getElementById('gemini-save');
  const chatgptSave    = document.getElementById('chatgpt-save');
  const claudeSave     = document.getElementById('claude-save');
  const grokSave       = document.getElementById('grok-save');
  const showNotifications = document.getElementById('show-notifications');
  const apiUrlInput    = document.getElementById('api-url');
  const saveSettingsBtn= document.getElementById('save-settings');
  const attachBar      = document.getElementById('attach-bar');
  const attachCount    = document.getElementById('attach-count');
  const attachBtn      = document.getElementById('attach-btn');

  // ── State ───────────────────────────────────────────────────────────────────
  let selectedItems = new Map(); // id → { title, narrative, facts }
  let attachQueued  = false;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function msg(message) {
    return new Promise(resolve =>
      chrome.runtime.sendMessage(message, r => resolve(r || {}))
    );
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Connection status ────────────────────────────────────────────────────────
  const offlineBanner = document.getElementById('offline-banner');
  const copyCmdBtn = document.getElementById('copy-cmd-btn');

  if (copyCmdBtn) {
    copyCmdBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('agentmemory');
      copyCmdBtn.textContent = '✓';
      setTimeout(() => copyCmdBtn.textContent = '📋', 2000);
    });
  }

  async function checkStatus() {
    statusBadge.className = 'status-badge checking';
    statusText.textContent = 'Checking…';
    const r = await msg({ type: 'STATUS' });
    if (r && r.connected) {
      statusBadge.className = 'status-badge connected';
      statusText.textContent = 'Connected';
      offlineBanner.classList.add('hidden');
    } else {
      statusBadge.className = 'status-badge disconnected';
      statusText.textContent = 'Offline';
      offlineBanner.classList.remove('hidden');
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────────
  async function loadSettings() {
    const s = await msg({ type: 'GET_SETTINGS' });
    if (!s) return;
    apiUrlInput.value   = s.apiUrl || 'http://localhost:3111';
    geminiSave.checked  = s.geminiAutoSave  !== false;
    chatgptSave.checked = s.chatgptAutoSave !== false;
    claudeSave.checked  = s.claudeAutoSave  !== false;
    grokSave.checked    = s.grokAutoSave    !== false;
    showNotifications.checked = s.showNotifications === true;
    const url = apiUrlInput.value;
    apiUrlDisplay.textContent = url.replace(/^https?:\/\//, '');
    if (dashboardLink) dashboardLink.href = url.replace(/:\d+\/?$/, ':3113/');
  }

  geminiSave.addEventListener('change',  () => msg({ type: 'SET_SETTINGS', settings: { geminiAutoSave:  geminiSave.checked  } }));
  chatgptSave.addEventListener('change', () => msg({ type: 'SET_SETTINGS', settings: { chatgptAutoSave: chatgptSave.checked } }));
  claudeSave.addEventListener('change',  () => msg({ type: 'SET_SETTINGS', settings: { claudeAutoSave:  claudeSave.checked  } }));
  grokSave.addEventListener('change',    () => msg({ type: 'SET_SETTINGS', settings: { grokAutoSave:    grokSave.checked    } }));
  showNotifications.addEventListener('change', () => msg({ type: 'SET_SETTINGS', settings: { showNotifications: showNotifications.checked } }));

  saveSettingsBtn.addEventListener('click', async () => {
    const url = apiUrlInput.value.trim().replace(/\/+$/, '');
    if (!url) return;
    await msg({ type: 'SET_SETTINGS', settings: { apiUrl: url } });
    apiUrlDisplay.textContent = url.replace(/^https?:\/\//, '');
    if (dashboardLink) dashboardLink.href = url.replace(/:\d+\/?$/, ':3113/');
    
    saveSettingsBtn.textContent = 'Saved ✓';
    saveSettingsBtn.classList.add('saved');
    setTimeout(() => {
      saveSettingsBtn.textContent = 'Save & Reconnect';
      saveSettingsBtn.classList.remove('saved');
    }, 2000);
    await checkStatus();
  });

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'recent') loadRecent();
    });
  });

  // ── Selection & Attach bar ───────────────────────────────────────────────────
  function updateAttachBar() {
    const count = selectedItems.size;
    if (count === 0) {
      attachBar.classList.add('hidden');
      attachQueued = false;
      attachBtn.textContent = '📎 Queue for next prompt';
      attachBtn.classList.remove('queued');
    } else {
      attachBar.classList.remove('hidden');
      attachCount.textContent = `${count} selected`;
      if (!attachQueued) {
        attachBtn.textContent = '📎 Queue for next prompt';
        attachBtn.classList.remove('queued');
      }
    }
  }

  function toggleCard(card, id, obsData) {
    if (selectedItems.has(id)) {
      selectedItems.delete(id);
      card.classList.remove('selected');
    } else {
      selectedItems.set(id, obsData);
      card.classList.add('selected');
    }
    // Reset queued state if user changes selection after queueing
    if (attachQueued) {
      attachQueued = false;
      attachBtn.textContent = '📎 Queue for next prompt';
      attachBtn.classList.remove('queued');
    }
    updateAttachBar();
  }

  attachBtn.addEventListener('click', async () => {
    if (attachQueued || selectedItems.size === 0) return;

    // Build context string from selected items
    let contextText = '';
    for (const [, obs] of selectedItems) {
      const title    = obs.title    || obs.subtitle || '';
      const narrative= obs.narrative || '';
      const facts    = (obs.facts || []).join('; ');
      if (title)     contextText += `### ${title}\n`;
      if (narrative) contextText += `${narrative}\n`;
      if (facts)     contextText += `Key facts: ${facts}\n`;
      contextText += '\n';
    }

    // Stage in chrome.storage.session — content script reads it synchronously
    await chrome.storage.session.set({ oamQueuedContext: contextText.trim() });

    // Update badge count in service worker
    await msg({ type: 'SET_QUEUE_COUNT', count: selectedItems.size });

    // Update UI to "queued" state
    attachQueued = true;
    attachBtn.textContent = `✓ ${selectedItems.size} memor${selectedItems.size === 1 ? 'y' : 'ies'} queued — send your prompt`;
    attachBtn.classList.add('queued');
    updateQueueBanner(contextText.trim());
  });

  // ── Queue banner ─────────────────────────────────────────────────────────────
  function updateQueueBanner(text) {
    if (!text) {
      queueBanner.classList.add('hidden');
      return;
    }
    const lineCount = text.split('\n').filter(l => l.trim()).length;
    queueLabel.textContent = `${selectedItems.size} memor${selectedItems.size === 1 ? 'y' : 'ies'} queued for next prompt`;
    queueBanner.classList.remove('hidden');
  }

  queueClearBtn.addEventListener('click', async () => {
    await chrome.storage.session.remove('oamQueuedContext');
    await msg({ type: 'SET_QUEUE_COUNT', count: 0 });
    selectedItems.clear();
    // Deselect all visible cards
    document.querySelectorAll('.result-card.selected').forEach(c => c.classList.remove('selected'));
    attachQueued = false;
    queueBanner.classList.add('hidden');
    updateAttachBar();
  });

  // Check if something was already queued (e.g. popup re-opened)
  async function initQueueBanner() {
    const data = await chrome.storage.session.get('oamQueuedContext');
    if (data.oamQueuedContext) {
      updateQueueBanner(data.oamQueuedContext);
    }
  }

  // ── Build result card ────────────────────────────────────────────────────────
  function buildCard(item) {
    const obs = item.observation || item;
    const id  = obs.id || obs.sessionId + (obs.title || '') + Math.random();
    const title    = obs.title    || obs.subtitle || 'Memory';
    const snippet  = obs.narrative || (obs.facts || []).slice(0, 2).join('. ') || '';
    const meta     = obs.sessionId || '';

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="card-check">✓</div>
      <div class="card-body">
        <div class="result-title">${esc(title)}</div>
        <div class="result-snippet">${esc(snippet)}</div>
        <div class="result-meta">${esc(meta)}</div>
      </div>
    `;

    // Re-select if this id was already chosen
    if (selectedItems.has(id)) card.classList.add('selected');

    card.addEventListener('click', () => toggleCard(card, id, obs));
    return card;
  }

  // ── Search tab ───────────────────────────────────────────────────────────────
  async function doSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    searchResults.innerHTML = '<div class="loading-text">Searching…</div>';

    const r = await msg({ type: 'SEARCH', platform: 'popup', query, limit: 8 });

    if (!r || r.error) {
      searchResults.innerHTML = `<div class="no-results">Error: ${esc(r?.error || 'No response')}</div>`;
      return;
    }

    const items = r.results || [];
    if (items.length === 0) {
      searchResults.innerHTML = '<div class="no-results">No memories found</div>';
      return;
    }

    searchResults.innerHTML = '';
    items.forEach(item => searchResults.appendChild(buildCard(item)));
  }

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // ── Recent tab ───────────────────────────────────────────────────────────────
  async function loadRecent() {
    recentResults.innerHTML = '<div class="loading-text">Loading…</div>';
    // Use a generic recent query — broad enough to surface latest entries
    const r = await msg({ type: 'SEARCH', platform: 'popup', query: 'conversation session', limit: 10 });

    if (!r || r.error) {
      recentResults.innerHTML = `<div class="no-results">Error: ${esc(r?.error || 'No response')}</div>`;
      return;
    }

    const items = r.results || [];
    if (items.length === 0) {
      recentResults.innerHTML = '<div class="no-results">No recent memories</div>';
      return;
    }

    recentResults.innerHTML = '';
    items.forEach(item => recentResults.appendChild(buildCard(item)));
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  await Promise.all([checkStatus(), loadSettings(), initQueueBanner()]);
  updateAttachBar();
});
