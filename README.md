# AI Context Manager v2.0

> 🚀 Stop re-explaining your project to AI tools. Generate once, reuse everywhere.

**Works with ChatGPT, Claude, Gemini, Grok, Perplexity — any AI tool.**

---

## ✨ Features

| Feature | Description |
|---|---|
| **Generate Context** | Auto-scan your project and create `project.ai.md` |
| **Copy Context** | One-click copy ready to paste into any AI tool |
| **File Picker Sidebar** | Select specific files to include their full contents |
| **Git History** | Auto-includes your last 10 commits |
| **Auto-Refresh** | Optionally regenerate on every file save |
| **Context Diff** | See what changed since last generation |
| **Status Bar Button** | Always-visible one-click copy button |

---

## 🚀 Quick Start

1. Open any project folder in VS Code
2. Press `Ctrl+Shift+Alt+G` (or `Cmd+Shift+Alt+G` on Mac)
3. `project.ai.md` is created in your workspace root
4. Press `Ctrl+Shift+Alt+C` to copy it to clipboard
5. Paste into ChatGPT, Claude, Gemini, or any AI tool!

---

## ⌨️ Commands

| Command | Shortcut | Description |
|---|---|---|
| `AI Context: Generate Project Context` | `Ctrl+Shift+Alt+G` | Scan & create `project.ai.md` |
| `AI Context: Copy Context` | `Ctrl+Shift+Alt+C` | Copy to clipboard |
| `AI Context: Refresh Context` | — | Silently regenerate |
| `AI Context: Show What Changed` | — | Diff since last generation |

---

## ⚙️ Settings

Open `Settings → Extensions → AI Context Manager` or edit `settings.json`:

```json
{
  "aiContextManager.autoRefreshOnSave": false,
  "aiContextManager.maxDepth": 4,
  "aiContextManager.gitLogCount": 10,
  "aiContextManager.outputFileName": "project.ai.md",
  "aiContextManager.autoOpenAfterGenerate": true,
  "aiContextManager.includeGitHistory": true,
  "aiContextManager.includeEnvKeys": true,
  "aiContextManager.includeScripts": true,
  "aiContextManager.ignoredFolders": ["node_modules", ".git", "dist", "build"]
}
```

---

## 📁 What Goes in project.ai.md?

- **Project Summary** — Plain English description
- **Tech Stack** — Auto-detected from `package.json`
- **Folder Structure** — Clean recursive tree
- **Key Files** — `package.json`, configs, Docker files, etc.
- **NPM Scripts** — All available scripts
- **Environment Variables** — Keys only, never values
- **Git History** — Last 10 commits
- **Selected File Contents** — If you chose files in the sidebar

---

## 🔒 Privacy

- Reads your `.env.example` / `.env.sample` for **key names only** — never values
- All processing is **100% local** — no data leaves your machine
- No API keys required, no telemetry, no accounts

---

## 📦 Building & Packaging

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Press F5 in VS Code to launch extension host

# Package for distribution
npm install -g @vscode/vsce
vsce package
```

---

## 🤝 Contributing

PRs welcome! See the file structure in `src/` — each feature lives in its own file.

---

**Made with ❤️ for developers who are tired of re-explaining their stack.**
