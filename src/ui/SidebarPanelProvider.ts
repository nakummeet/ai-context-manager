import * as vscode from 'vscode';

export class SidebarPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aicodebridge-sidebar';

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
    };

    const iconUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        'images',
        'icon.ico'
      )
    );

    webviewView.webview.html = this.getHtml(iconUri);

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'sendToAIWith' && msg.tool) {
        vscode.commands.executeCommand('aicodebrdige.sendToAIWith', msg.tool);
      } else {
        vscode.commands.executeCommand(`aicodebrdige.${msg.command}`);
      }
    });
  }

  private getHtml(iconUri: vscode.Uri): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AICodeBridge</title>

  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: transparent;
      color: var(--vscode-foreground);
      padding: 12px 10px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 100vh;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 2px 10px;
      border-bottom: 1px solid var(--vscode-widget-border, #333);
      margin-bottom: 4px;
    }

    .logo {
      width: 22px;
      height: 22px;
      object-fit: cover;
      border-radius: 5px;
      flex-shrink: 0;
    }

    .header-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .title {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-foreground);
      letter-spacing: 0.02em;
    }

    .subtitle {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.03em;
    }

    /* Section Label */
    .label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--vscode-descriptionForeground);
      padding: 6px 2px 4px;
    }

    /* Buttons */
    .btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 10px;
      background: var(--vscode-button-secondaryBackground, #2a2d2e);
      border: 1px solid var(--vscode-widget-border, #3c3c3c);
      border-radius: 6px;
      color: var(--vscode-foreground);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: background 0.15s, border-color 0.15s;
      outline: none;
    }

    .btn:hover {
      background: var(--vscode-list-hoverBackground, #2a2d2e);
      border-color: var(--vscode-focusBorder, #007fd4);
    }

    .btn:active {
      opacity: 0.85;
    }

    .btn-icon {
      font-size: 14px;
      width: 20px;
      text-align: center;
      flex-shrink: 0;
    }

    .btn-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
    }

    .btn-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .btn-desc {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }

    .btn-basic { border-left: 2px solid #4f8eff; }
    .btn-tree  { border-left: 2px solid #3ecf8e; }
    .btn-full  { border-left: 2px solid #f97316; }
    .btn-send  { border-left: 2px solid #a855f7; }

    /* Divider */
    .divider {
      height: 1px;
      background: var(--vscode-widget-border, #333);
      margin: 6px 0;
    }

    /* AI picker dropdown */
    .ai-menu {
      flex-direction: column;
      gap: 3px;
      background: var(--vscode-button-secondaryBackground, #252526);
      border: 1px solid var(--vscode-widget-border, #3c3c3c);
      border-radius: 6px;
      padding: 5px;
      margin-top: -2px;
    }

    .ai-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 4px;
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      font-family: inherit;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: background 0.12s;
      outline: none;
    }

    .ai-option:hover {
      background: var(--vscode-list-hoverBackground, #2a2d2e);
    }

    .ai-option:active {
      opacity: 0.8;
    }

    .ai-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .ai-label {
      flex: 1;
    }

    .ai-hint {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
      opacity: 0.7;
    }

    /* Small buttons row */
    .row {
      display: flex;
      gap: 6px;
    }

    .btn-sm {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 7px 6px;
      background: var(--vscode-button-secondaryBackground, #2a2d2e);
      border: 1px solid var(--vscode-widget-border, #3c3c3c);
      border-radius: 6px;
      color: var(--vscode-descriptionForeground);
      font-family: inherit;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      outline: none;
    }

    .btn-sm:hover {
      background: var(--vscode-list-hoverBackground);
      color: var(--vscode-foreground);
      border-color: var(--vscode-focusBorder, #007fd4);
    }

    /* Status */
    .status {
      margin-top: auto;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: var(--vscode-button-secondaryBackground, #2a2d2e);
      border: 1px solid var(--vscode-widget-border, #3c3c3c);
      border-radius: 6px;
    }

    .dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #3ecf8e;
      flex-shrink: 0;
      animation: pulse 2.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .status-text {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
    }

    /* Arrow indicator on Send to AI button */
    .btn-arrow {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      transition: transform 0.2s;
      flex-shrink: 0;
    }

    .btn-arrow.open {
      transform: rotate(180deg);
    }
  </style>
</head>

<body>

  <!-- Header -->
  <div class="header">
    <img src="${iconUri}" alt="Logo" class="logo">
    <div class="header-text">
      <span class="title">AICodeBridge</span>
      <span class="subtitle">AI context generator</span>
    </div>
  </div>

  <!-- Generate -->
  <div class="label">Generate</div>

  <button class="btn btn-basic" onclick="send('generateBasic')">
    <span class="btn-icon">⚡</span>
    <div class="btn-info">
      <span class="btn-name">Basic</span>
      <span class="btn-desc">Overview + structure + git</span>
    </div>
  </button>

  <button class="btn btn-tree" onclick="send('generateTree')">
    <span class="btn-icon">🌳</span>
    <div class="btn-info">
      <span class="btn-name">Tree</span>
      <span class="btn-desc">Full project file tree</span>
    </div>
  </button>

  <button class="btn btn-full" onclick="send('generateFull')">
    <span class="btn-icon">📄</span>
    <div class="btn-info">
      <span class="btn-name">Full Code</span>
      <span class="btn-desc">Select files → export code</span>
    </div>
  </button>

  <div class="divider"></div>

  <!-- Actions -->
  <div class="label">Actions</div>

  <!-- Send to AI button with dropdown toggle -->
  <button class="btn btn-send" onclick="toggleAIMenu()" id="sendBtn">
    <span class="btn-icon">🚀</span>
    <div class="btn-info">
      <span class="btn-name">Send to AI</span>
      <span class="btn-desc">Open in browser</span>
    </div>
    <span class="btn-arrow" id="btnArrow">▾</span>
  </button>

  <!-- AI picker — hidden by default, shown on toggle -->
  <div class="ai-menu" id="aiMenu" style="display:none;">
    <button class="ai-option" onclick="sendToAI('chatgpt')">
      <span class="ai-dot" style="background:#10a37f;"></span>
      <span class="ai-label">ChatGPT</span>
      <span class="ai-hint">opens browser</span>
    </button>
    <button class="ai-option" onclick="sendToAI('claude')">
      <span class="ai-dot" style="background:#d97706;"></span>
      <span class="ai-label">Claude</span>
      <span class="ai-hint">opens browser</span>
    </button>
    <button class="ai-option" onclick="sendToAI('gemini')">
      <span class="ai-dot" style="background:#4285f4;"></span>
      <span class="ai-label">Gemini</span>
      <span class="ai-hint">opens browser</span>
    </button>
  </div>

  <!-- Small action buttons -->
  <div class="row">
    <button class="btn-sm" onclick="send('copy')">
      📋 Copy
    </button>
    <button class="btn-sm" onclick="send('refresh')">
      🔄 Refresh
    </button>
  </div>

  <!-- Status -->
  <div class="status">
    <div class="dot"></div>
    <span class="status-text">ready · aicodebrdige.md</span>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function send(cmd) {
      vscode.postMessage({ command: cmd });
    }

    function toggleAIMenu() {
      const menu = document.getElementById('aiMenu');
      const arrow = document.getElementById('btnArrow');
      const isOpen = menu.style.display !== 'none';
      menu.style.display = isOpen ? 'none' : 'flex';
      arrow.classList.toggle('open', !isOpen);
    }

    function sendToAI(tool) {
      vscode.postMessage({ command: 'sendToAIWith', tool: tool });
      document.getElementById('aiMenu').style.display = 'none';
      document.getElementById('btnArrow').classList.remove('open');
    }
  </script>

</body>
</html>`;
  }
}