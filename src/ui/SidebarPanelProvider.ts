import * as vscode from 'vscode';

export class SidebarPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aibridgeSidebar';

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage((msg) => {
      vscode.commands.executeCommand(`aibridge.${msg.command}`);
    });
  }

  private getHtml(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AIBridge</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Syne:wght@500;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        #0d0d0f;
      --surface:   #141417;
      --border:    #222228;
      --accent-1:  #4f8eff;   /* electric blue  */
      --accent-2:  #3ecf8e;   /* terminal green */
      --accent-3:  #ff5f5f;   /* hot coral      */
      --muted:     #52525e;
      --text:      #e8e8f0;
      --text-dim:  #8888a0;
      --radius:    10px;
    }

    html, body {
      height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      overflow-x: hidden;
    }

    /* ── noise overlay ─────────────────────────── */
    body::before {
      content: '';
      position: fixed; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
      pointer-events: none; z-index: 0;
    }

    .wrap {
      position: relative; z-index: 1;
      padding: 18px 14px 24px;
      display: flex; flex-direction: column; gap: 20px;
      min-height: 100vh;
    }

    /* ── header ────────────────────────────────── */
    .header {
      display: flex; align-items: center; gap: 10px;
    }
    .logo {
      width: 28px; height: 28px;
      border-radius: 7px;
      background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
      display: grid; place-items: center;
      font-size: 14px; flex-shrink: 0;
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent-1) 40%, transparent);
    }
    .title {
      font-size: 13px; font-weight: 700; letter-spacing: .04em;
      color: var(--text);
    }
    .badge {
      margin-left: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; font-weight: 600;
      padding: 2px 7px; border-radius: 99px;
      background: color-mix(in srgb, var(--accent-2) 15%, transparent);
      color: var(--accent-2);
      border: 1px solid color-mix(in srgb, var(--accent-2) 30%, transparent);
      letter-spacing: .06em;
    }

    /* ── divider ───────────────────────────────── */
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--border) 30%, var(--border) 70%, transparent);
    }

    /* ── section label ─────────────────────────── */
    .section-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; font-weight: 600; letter-spacing: .12em;
      color: var(--muted); text-transform: uppercase;
      margin-bottom: -8px;
    }

    /* ── action buttons ────────────────────────── */
    .actions { display: flex; flex-direction: column; gap: 8px; }

    .btn {
      position: relative; overflow: hidden;
      display: flex; align-items: center; gap: 12px;
      width: 100%; padding: 12px 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      font-size: 12px; font-weight: 600;
      cursor: pointer; text-align: left;
      transition: border-color .2s, box-shadow .2s, transform .12s;
      outline: none;
      -webkit-app-region: no-drag;
    }
    .btn:hover  { transform: translateY(-1px); }
    .btn:active { transform: translateY(0px) scale(.985); }

    /* glow accent per button */
    .btn-basic  { --c: var(--accent-1); }
    .btn-tree   { --c: var(--accent-2); }
    .btn-full   { --c: var(--accent-3); }

    .btn:hover {
      border-color: var(--c);
      box-shadow: 0 0 18px color-mix(in srgb, var(--c) 25%, transparent),
                  inset 0 0 18px color-mix(in srgb, var(--c) 6%, transparent);
    }

    /* shimmer sweep on hover */
    .btn::after {
      content: '';
      position: absolute; top: 0; left: -100%;
      width: 60%; height: 100%;
      background: linear-gradient(105deg, transparent, rgba(255,255,255,.06), transparent);
      transition: left .35s ease;
    }
    .btn:hover::after { left: 140%; }

    .btn-icon {
      width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0;
      background: color-mix(in srgb, var(--c) 18%, transparent);
      border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
      display: grid; place-items: center;
      font-size: 14px;
      transition: background .2s;
    }
    .btn:hover .btn-icon {
      background: color-mix(in srgb, var(--c) 28%, transparent);
    }

    .btn-text { display: flex; flex-direction: column; gap: 1px; }
    .btn-label { font-size: 12px; font-weight: 700; color: var(--text); }
    .btn-desc  { font-size: 10px; font-weight: 500; color: var(--text-dim); }

    .btn-arrow {
      margin-left: auto; font-size: 12px;
      color: var(--muted);
      transition: color .2s, transform .2s;
    }
    .btn:hover .btn-arrow {
      color: var(--c);
      transform: translateX(3px);
    }

    /* ── status strip ──────────────────────────── */
    .status {
      margin-top: auto;
      display: flex; align-items: center; gap: 8px;
      padding: 9px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--accent-2);
      box-shadow: 0 0 6px var(--accent-2);
      animation: pulse 2.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%,100% { opacity: 1; }
      50%      { opacity: .35; }
    }
    .status-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; color: var(--text-dim);
      letter-spacing: .04em;
    }

    /* ── entry animation ───────────────────────── */
    .btn { animation: slideIn .3s ease both; }
    .btn:nth-child(1) { animation-delay: .05s; }
    .btn:nth-child(2) { animation-delay: .10s; }
    .btn:nth-child(3) { animation-delay: .15s; }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
  </style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <div class="header">
    <div class="logo">⚡</div>
    <span class="title">AIBridge</span>
    <span class="badge">BETA</span>
  </div>

  <div class="divider"></div>

  <!-- Actions -->
  <span class="section-label">Generate</span>
  <div class="actions">

    <button class="btn btn-basic" onclick="send('generateBasic')">
      <div class="btn-icon">⚡</div>
      <div class="btn-text">
        <span class="btn-label">Basic</span>
        <span class="btn-desc">Quick context snapshot</span>
      </div>
      <span class="btn-arrow">›</span>
    </button>

    <button class="btn btn-tree" onclick="send('generateTree')">
      <div class="btn-icon">🌳</div>
      <div class="btn-text">
        <span class="btn-label">Tree</span>
        <span class="btn-desc">Project structure map</span>
      </div>
      <span class="btn-arrow">›</span>
    </button>

    <button class="btn btn-full" onclick="send('generateFull')">
      <div class="btn-icon">📄</div>
      <div class="btn-text">
        <span class="btn-label">Full</span>
        <span class="btn-desc">Complete codebase export</span>
      </div>
      <span class="btn-arrow">›</span>
    </button>

  </div>

  <!-- Status -->
  <div class="status">
    <div class="status-dot"></div>
    <span class="status-text">extension active · workspace ready</span>
  </div>

</div>

<script>
  const vscode = acquireVsCodeApi();
  function send(cmd) {
    vscode.postMessage({ command: cmd });
  }
</script>
</body>
</html>
    `;
  }
}