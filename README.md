# 🧠 OpenAgentMemory

**Bridge the gap between Web UI limits and Local Agent Persistence.**

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

OpenAgentMemory is a sleek, cross-platform browser extension that connects web-based AI coding assistants (like Gemini and ChatGPT) directly to your local file system via the `@agentmemory/agentmemory` daemon.

It transparently injects persistent, long-term memory into your chat inputs, giving your web AI the context retention of an autonomous desktop agent.

---

## ⚡ The Problem: Web Apps vs. Desktop Agents

The landscape of AI coding tools is split, forcing developers to make a difficult trade-off:

### 1. Web-Based Apps (ChatGPT, Gemini Advanced)
- **The Pros:** Predictable, flat-fee subscription pricing ($20/mo) and an intuitive, rich chat UI.
- **The Cons:** Aggressive "forgetting" algorithms. To save on compute costs and stay within budget, web providers quietly truncate your interaction history or dynamically summarize context. You frequently lose context on complex, long-running projects.

### 2. Desktop & CLI Agents (Claude Code, etc.)
- **The Pros:** Deep integration with your local repository. They gather "surgical" context natively and don't aggressively drop history.
- **The Cons:** They operate on a Bring-Your-Own-API-Key model. Every time a CLI agent re-reads your codebase to regain context, you pay for the raw token consumption. A single complex task can rack up significant API costs fast.

## 💡 The Solution: Best of Both Worlds

**OpenAgentMemory** gives you the rich UI and flat-fee pricing of web-based LLMs while injecting the persistence and "surgical" repository context of a desktop agent. 

By running a lightweight local daemon, the extension dynamically captures your conversations and securely stores them. When you start a new session, the extension pre-pends relevant, compressed memory directly into the web UI—ensuring the AI *never* forgets your project's history, architecture, or previous decisions.

---

## 🚀 Installation & Setup

Because OpenAgentMemory relies on a local daemon, setup requires two quick steps:

### 1. Start the Local Daemon
Ensure you have [Node.js](https://nodejs.org/) installed, then run the daemon in your terminal:
```bash
npx @agentmemory/agentmemory
```
*This starts the memory server on `localhost:3111`.*

### 2. Install the Extension
1. Download or clone this repository.
2. Open your Chromium-based browser (Chrome, Edge, Brave, Arc) and navigate to `chrome://extensions`.
3. Enable **Developer Mode** in the top right corner.
4. Click **Load unpacked** and select the folder containing this repository.

That's it! Open Gemini or ChatGPT and you'll see OpenAgentMemory silently enhancing your context in the background.

---

## 🎨 UI & Features

- **Lightweight & Fast:** Synchronous pre-injection intercepts your chat submission *before* the web UI processes it.
- **Minimalist Popup:** A beautifully designed light-theme popup lets you easily toggle memory on and off.
- **Offline Banner:** If your daemon stops running, the extension gracefully degrades with an offline banner providing a one-click copyable start command.
- **Cross-Platform:** Built on standard web technologies and Node.js. Runs flawlessly on Windows, macOS, and Linux.

---

## 🔒 Privacy & Security

Your code and conversation history never touch our servers. Everything is processed locally between your browser and the Node.js daemon running securely on `localhost:3111`.

---

*Built for power users who demand endless memory without endless API bills.*
