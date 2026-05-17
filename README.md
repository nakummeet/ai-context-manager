# AICodeBridge

> Bridge your codebase to any AI tool instantly — no more re-explaining your stack.

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/nakummeet.aibridge?label=VS%20Code%20Marketplace&color=007acc)](https://marketplace.visualstudio.com/items?itemName=nakummeet.aibridge)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/nakummeet.aibridge)](https://marketplace.visualstudio.com/items?itemName=nakummeet.aibridge)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)

---

## What is AICodeBridge?

Every time you open ChatGPT, Claude, or Gemini to ask about your project, you spend the first few messages just explaining what it is. AICodeBridge fixes that.

It analyzes your codebase and generates a clean, structured Markdown file — tech stack, project structure, key files, git history — everything an AI needs to understand your project instantly. One click, then ask your question.

Works with **GitHub Copilot** (built-in), **ChatGPT**, **Claude**, **Gemini**, and any other AI tool via clipboard.

---

![AICodeBridge Demo](images/demo.gif)

---
## Features

### Three Generation Modes

| Mode | What it includes | Best for |
|------|-----------------|----------|
| ⚡ **Basic** | Overview, structure, git history | Quick questions, debugging |
| 🌳 **Tree** | Full file tree with architecture | "Help me redesign this" |
| 📄 **Full Code** | Complete file contents (you pick files) | Deep code review, refactoring |

### Ask Copilot (Built-in)
- Opens GitHub Copilot Chat directly inside VS Code
- Auto-attaches your context file — just type your question and hit Enter
- If Copilot Chat isn't installed, prompts you to install it from the marketplace
- No sign-in handling needed — Copilot manages its own auth flow

### Smart Project Analysis
- Auto-detects tech stack from `package.json`, config files, and file extensions
- Supports TypeScript, JavaScript, Python, Go, Rust, Java, Ruby, PHP, Flutter, and more
- Picks up frameworks: React, Next.js, Express, NestJS, Vue, and 30+ others

### Error Detection
- Reads VS Code's built-in diagnostics for any language
- Falls back to `tsc --noEmit` for TypeScript projects
- Appends a formatted error table directly to your context file

### Copy Context
- Copies your full context to clipboard with `My question:` ready at the end
- Paste into ChatGPT, Claude, Gemini, or any AI tool

### File Picker
- Check/uncheck individual files or entire folders for Full Code mode
- Binary files, lock files, and generated files are automatically skipped

### Auto-Refresh
- Optionally regenerates your context file on every save
- Error section always stays fresh — updates after every file save regardless

---

## Installation

**From the VS Code Marketplace:**

1. Open VS Code
2. Search `AICodeBridge` in the Extensions sidebar
3. Click Install

**Or visit:** https://marketplace.visualstudio.com/items?itemName=nakummeet.aibridge

---

## Quick Start

1. Open your project folder in VS Code
2. Click the **AICodeBridge icon** in the Activity Bar (left sidebar)
3. Choose a generation mode — start with **⚡ Basic**
4. Click **🤖 Ask Copilot** to open Copilot Chat with your context attached
5. Type your question and press Enter

---

## Configuration

All settings are under `aicodebrdige.*` in VS Code settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `outputFileName` | `aicodebrdige.md` | Name of the generated context file |
| `autoOpenAfterGenerate` | `true` | Open the file in editor after generation |
| `includeGitHistory` | `true` | Include recent git commits |
| `gitLogCount` | `10` | Number of commits to include |
| `includeScripts` | `true` | Include npm scripts |
| `includeEnvKeys` | `true` | Include env variable key names (never values) |
| `autoRefreshOnSave` | `false` | Regenerate context on every file save |
| `maxDepth` | `4` | Max folder depth to scan |
| `ignoredFolders` | `[node_modules, .git, dist, ...]` | Folders to exclude |

---

## Commands

| Command | Description |
|---------|-------------|
| `AICodeBridge: Ask AI (Quick Context)` | Generate Basic mode context |
| `AICodeBridge: Ask AI (Project Structure)` | Generate Tree mode context |
| `AICodeBridge: Ask AI (Full Codebase)` | Generate Full Code mode (uses selected files) |
| `AICodeBridge: Ask Copilot` | Open Copilot Chat with context attached |
| `AICodeBridge: Copy Context` | Copy context to clipboard |
| `AICodeBridge: Detect Errors` | Scan and append errors to context file |
| `AICodeBridge: Refresh Context` | Regenerate context file manually |
| `AICodeBridge: Chat History` | View recent AI sessions |

---

## Author

**Meet Nakum** <br> Computer Engineering Student, Flutter & MERN stack developer

---

## License

[Proprietary](./LICENSE)