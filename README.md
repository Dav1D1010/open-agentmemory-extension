# 🧠 OpenAgentMemory

**Sync your Web AI conversations down to your local coding agents.**

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

OpenAgentMemory is a sleek, cross-platform browser extension that connects web-based AI assistants (like Gemini and ChatGPT) directly to your local file system via the `agentmemory` daemon.

While it injects long-term memory into your web chats, its **core superpower is syncing what you discuss in the browser down to your local machine.**

*Note: This extension requires the core **[AgentMemory Daemon](https://github.com/rohitg00/agentmemory)** to be running locally.*

---

## ⚡ The Problem & Solution

As developers, we often use different AI tools for different stages of work. You might use Gemini Advanced or ChatGPT in the browser for high-level brainstorming, architecture design, and problem-solving. Then, you switch to your local desktop coding agents (like Claude Code or AI IDEs) to actually implement the code.

**The Problem:**
These workflows are disjointed. Your local coding agent has no idea what architectural decisions you just finalized in your browser session. You're forced to manually copy-paste context, prompts, and code snippets between the web and your terminal.

**The Solution:**
**OpenAgentMemory** bridges this gap seamlessly. It runs a lightweight local daemon that captures your web-based LLM conversations in real-time and securely stores them. 

When you ideate in the browser, that knowledge is instantly synced to your local personal memory. When you switch to your desktop coding agent, it can automatically query your `agentmemory` daemon to retrieve the exact context, decisions, and code generated during your web session. It acts as a unified "second brain" for all your AI tools.

---

## 🚀 Installation & Setup

Setup requires two quick steps:

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

That's it! Open Gemini or ChatGPT, and you'll see OpenAgentMemory silently syncing your sessions in the background.

---

## 🎨 UI & Features

- **Seamless Syncing:** Automatically captures inputs and responses from web interfaces and saves them to your local daemon.
- **Lightweight & Fast:** Synchronous background execution that doesn't slow down your browsing.
- **Minimalist Popup:** A beautifully designed light-theme popup lets you quickly toggle memory syncing on and off.
- **Cross-Platform:** Built on standard web technologies and Node.js. Runs flawlessly on Windows, macOS, and Linux.

---

## 🔒 Privacy & Security

Your code and conversation history never touch our servers. Everything is processed entirely locally between your browser and the Node.js daemon running securely on your machine.
