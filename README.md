# Open AgentMemory

A Chromium extension that connects ChatGPT, Claude, Gemini, and Grok to a
locally running [AgentMemory](https://github.com/rohitg00/agentmemory) daemon.

The extension captures completed user/assistant exchanges, lets you search the
same memory store from its popup, and can prepend selected memories to your next
web prompt. Local coding agents connected to that AgentMemory daemon can recall
the same conversations.

## Features

- Automatically saves completed conversation turns per supported provider.
- Searches AgentMemory without leaving the active browser tab.
- Queues selected memories and visibly prepends them to the next prompt.
- Enables or disables capture independently for each provider.
- Shows daemon connectivity and queued-memory count in the extension badge.
- Supports `AGENTMEMORY_SECRET` bearer authentication.
- Keeps API access restricted to `localhost` and `127.0.0.1`.

## Supported Sites

| Provider | Site |
| --- | --- |
| ChatGPT | `chatgpt.com`, `chat.openai.com` |
| Claude | `claude.ai` |
| Gemini | `gemini.google.com` |
| Grok | `grok.com` |

These sites change their DOM periodically. If capture or prompt injection stops
working after a site update, its selector list in `content/<provider>.js` may
need adjustment.

## Requirements

- A Chromium-based browser such as Chrome, Edge, Brave, or Arc.
- Node.js 20 or newer for AgentMemory.
- A local AgentMemory daemon.

## Installation

### 1. Start AgentMemory

Run the daemon in a separate terminal:

```bash
npx -y @agentmemory/agentmemory@latest
```

The REST API defaults to `http://localhost:3111`. Confirm it is healthy:

```bash
curl http://localhost:3111/agentmemory/health
```

The AgentMemory viewer is normally available at
`http://localhost:3113`.

### 2. Load the Extension

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose this repository's root directory.

Pin Open AgentMemory from the browser toolbar for quick access.

## Usage

### Capture Conversations

Open a supported AI site and chat normally. After both the user prompt and
assistant response are present in the page, the extension sends the pair to the
local daemon as a `prompt_submit` observation.

Capture is enabled by default for every provider. Use **Settings > Auto-save**
to disable individual sites. Save notifications are optional and disabled by
default.

### Recall Memories

1. Open the extension popup.
2. Search for relevant past work.
3. Select one or more results.
4. Choose **Queue for next prompt**.
5. Return to a supported chat and send your next prompt.

Queued context is inserted into the prompt before it is sent. It is visible in
the editor and is therefore also sent to that AI provider.

### Configure the Daemon

The default API URL is `http://localhost:3111`. The extension accepts loopback
HTTP URLs on any port.

If the daemon uses `AGENTMEMORY_SECRET`, enter the same value under
**Settings > API > Bearer secret**. The secret is stored in
`chrome.storage.local` and attached only to requests sent to the configured
loopback daemon.

## Privacy and Permissions

Open AgentMemory does not send data to a service operated by this extension.
Conversation captures and searches are sent from the browser extension to the
configured local AgentMemory API.

The extension requests:

- `storage`: settings and one queued context payload.
- `alarms`: periodic daemon health checks.
- Loopback host access: AgentMemory REST requests on `localhost` or
  `127.0.0.1`.
- Content-script access to the four supported AI sites.

Remember that queued context becomes part of the prompt sent to the selected AI
provider. Review sensitive memories before attaching them.

## Architecture

```text
Supported AI page
  -> provider adapter (selectors only)
  -> shared content runtime
  -> extension service worker
  -> AgentMemory REST API on localhost

Extension popup
  -> search memories
  -> queue selected context in chrome.storage.session
  -> shared content runtime prepends it to the next prompt
```

`content/shared.js` owns capture, deduplication, session lifecycle,
queued-context injection, and SPA navigation. Provider files contain only the
DOM selectors needed for each site.

## Development

There is no build step. After editing the source, reload the unpacked extension
from `chrome://extensions`.

Run the dependency-free service-worker tests with:

```bash
npm test
```

Run syntax checks directly with Node:

```bash
node --check service-worker.js
node --check content/shared.js
node --check popup/popup.js
```

## Troubleshooting

### The badge shows `!`

- Confirm AgentMemory is running.
- Open `http://localhost:3111/agentmemory/health`.
- Check the API URL and bearer secret in extension settings.
- Reload the extension after changing `manifest.json`.

### Conversations are not being saved

- Confirm auto-save is enabled for the current provider.
- Wait until the assistant response has finished rendering.
- Reload the AI page and inspect the extension's service-worker console.
- Check whether the provider changed its page markup.

### Queued context is not inserted

- Queue the memory before sending the prompt.
- Confirm the queue banner is visible on the AI page.
- Reload the extension and the AI page after updating content scripts.

### The dashboard button opens the wrong port

The extension assumes the AgentMemory viewer uses port `3113`. If your viewer
uses another port, open it directly in the browser.
