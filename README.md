# 🧠 OpenAgentMemory

**Bridge the gap between Web AI limits and Local Agent Persistence.**

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

OpenAgentMemory is a sleek, cross-platform browser extension that connects web-based AI coding assistants (like Gemini and ChatGPT) directly to your local file system via the local `agentmemory` daemon.

It transparently injects persistent, long-term memory into your chat inputs, giving your web AI the context retention of an autonomous desktop agent.

*Note: This extension requires the core **[AgentMemory Daemon](https://github.com/Dav1D1010/agentmemory)** to be running locally.*

---

## ⚡ The Problem & Solution

AI providers currently offer **separate usage limits** for their Web apps and Desktop/API agents. Even if you have a flat-fee subscription for both, maxing out your usage on a desktop agent doesn't impact your web app quota (and vice versa). 

To maximize your productivity without hitting limits, it's smart to utilize both platforms. However, web apps lack the deep, persistent repository memory of desktop agents and often quietly truncate your conversation history to save compute.

**The Solution:**
**OpenAgentMemory** gives you the best of both worlds. It runs a lightweight local daemon that captures your web conversations and securely stores them. When you start a new web session, the extension pre-pends relevant, compressed memory directly into the UI. You get the rich interface and separate usage limits of web-based LLMs, augmented with the persistence of a local desktop agent.

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
