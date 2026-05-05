# AIBridge — contextflow
> Generated on 5/6/2026, 3:45:20 AM  |  Mode: 📄 Full Code
> Paste into ChatGPT, Claude, Gemini, or any AI tool.

---

## 📋 Project Overview

**contextflow** is a TypeScript project.

**contextflow** is a TypeScript project.

## 🏗 Core Architecture

- Static project — no server-side architecture detected

## 🔄 Business Flow

Client sends request → Middleware validates → Controller processes → Response returned

## 🛠 Tech Stack

- **Language:** TypeScript
- **Dev Tools:** TypeScript

## 🔧 Available Scripts

- `vscode:prepublish` → npm run compile
- `compile` → tsc -p ./
- `watch` → tsc -watch -p ./

## 📎 Selected Files — Full Code

### src/commands/copyContext.ts  _(63 lines)_
```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { flashStatusBar } from '../statusBar';

export async function copyContext(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    vscode.window.showErrorMessage('ContextFlow: Please open a folder first.');
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('contextflow');
  const outputFileName = config.get<string>('outputFileName') ?? 'contextflow.md';
  const outputFilePath = path.join(rootPath, outputFileName);

  if (!fs.existsSync(outputFilePath)) {
    const answer = await vscode.window.showWarningMessage(
      `ContextFlow: ${outputFileName} does not exist yet.`,
      'Generate Now',
      'Cancel'
    );

    if (answer === 'Generate Now') {
      await vscode.commands.executeCommand('contextflow.generateBasic');
      if (!fs.existsSync(outputFilePath)) return;
    } else {
      return;
    }
  }

  let content: string;
  try {
    content = fs.readFileSync(outputFilePath, 'utf-8');
  } catch (err) {
    vscode.window.showErrorMessage(
      `ContextFlow: Could not read ${outputFileName} — ${String(err)}`
    );
    return;
  }

  const clipboardContent = `Here is my project context:\n\n${content}\n\n---\n\nMy question: `;

  try {
    await vscode.env.clipboard.writeText(clipboardContent);
  } catch (err) {
    vscode.window.showErrorMessage(
      `ContextFlow: Failed to copy to clipboard — ${String(err)}`
    );
    return;
  }

  flashStatusBar(
    '$(copy) Context copied!',
    'Project context copied to clipboard — paste into any AI tool',
    4000
  );

  vscode.window.showInformationMessage(
    '📋 ContextFlow: Context copied! Paste into ChatGPT, Claude, Gemini, or any AI tool.'
  );
}
```

### src/commands/generateContext.ts  _(109 lines)_
```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { detectTechStack, getProjectName } from '../utils/techDetector';
import { getGitHistory } from '../utils/gitHelper';
import { buildMarkdown, GenerateMode } from '../utils/markdownBuilder';
import { flashStatusBar } from '../statusBar';

export async function generateContext(
  selectedFiles: string[] = [],
  mode: GenerateMode = 'basic'
): Promise<void> {

  try {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!root) {
      vscode.window.showErrorMessage('ContextFlow: Please open a folder first.');
      return;
    }

    const cfg = vscode.workspace.getConfiguration('contextflow');
    const outFileName = cfg.get<string>('outputFileName') ?? 'contextflow.md';
    const outFile = path.join(root, outFileName);
    const autoOpen = cfg.get<boolean>('autoOpenAfterGenerate') ?? true;

    if (mode === 'basic' || mode === 'tree') {
      selectedFiles = [];
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `ContextFlow — Generating ${mode}...`,
        cancellable: false,
      },
      async (progress) => {

        progress.report({ message: 'Scanning workspace...', increment: 20 });
        const scan = scanWorkspace(root);

        if (scan.totalFileCount > 10000) {
          const ans = await vscode.window.showWarningMessage(
            `ContextFlow: ${scan.totalFileCount.toLocaleString()} files found. Continue?`,
            'Continue',
            'Cancel'
          );
          if (ans !== 'Continue') return;
        }

        progress.report({ message: 'Detecting tech stack...', increment: 20 });
        const techStack = detectTechStack(root);

        progress.report({ message: 'Reading git history...', increment: 20 });
        const includeGit = cfg.get<boolean>('includeGitHistory') ?? true;
        const gitCommits = includeGit ? await getGitHistory(root) : [];

        progress.report({ message: `Building ${mode} output...`, increment: 30 });

        const md = buildMarkdown({
          projectName: getProjectName(root),
          rootPath: root,
          techStack,
          tree: scan.tree,
          keyFiles: scan.keyFiles,
          gitCommits,
          selectedFiles,
          treeFlat: scan.allFiles,
          mode,
        });

        await fs.promises.writeFile(outFile, md, 'utf-8');

        progress.report({ message: 'Done!', increment: 10 });

        if (autoOpen) {
          const doc = await vscode.workspace.openTextDocument(outFile);
          await vscode.window.showTextDocument(doc);
        }

        const modeNames: Record<GenerateMode, string> = {
          basic: 'Basic',
          tree: 'Project Tree',
          full: 'Full Code',
        };

        flashStatusBar(
          '$(check) ContextFlow generated',
          `${outFileName} ready (${modeNames[mode]} mode)`,
          4000
        );

        vscode.window.showInformationMessage(
          `✅ ContextFlow: Generated in ${modeNames[mode]} mode` +
          (mode === 'full' && selectedFiles.length > 0
            ? ` — ${selectedFiles.length} file(s)`
            : '')
        );
      }
    );

  } catch (err: any) {
    console.error('ContextFlow Error:', err);
    vscode.window.showErrorMessage(
      `❌ ContextFlow failed: ${err?.message || 'Unknown error'}`
    );
  }
}
```

### src/commands/refreshContext.ts  _(65 lines)_
```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { detectTechStack, getProjectName } from '../utils/techDetector';
import { getGitHistory, hasGitRepo } from '../utils/gitHelper';
import { buildMarkdown } from '../utils/markdownBuilder';
import { flashStatusBar } from '../statusBar';

export async function refreshContext(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('ContextFlow: No folder open. Open a project first.');
    return;
  }

  const rootUri = workspaceFolders[0].uri;
  const rootPath = rootUri.fsPath;

  const config = vscode.workspace.getConfiguration('contextflow');
  const outputFileName = config.get<string>('outputFileName') ?? 'contextflow.md';
  const includeGit = config.get<boolean>('includeGitHistory') ?? true;

  try {
    const scanResult = scanWorkspace(rootPath);

    let techStack = null;
    try {
      techStack = detectTechStack(rootPath);
    } catch (e) {
      console.log('ContextFlow: Tech stack detection failed:', e);
    }

    let gitCommits: import('../utils/gitHelper').GitCommit[] = [];
    if (includeGit && hasGitRepo(rootPath)) {
      try {
        gitCommits = await getGitHistory(rootPath);
      } catch (e) {
        console.log('ContextFlow: Git fetch failed:', e);
      }
    }

    const markdown = buildMarkdown({
      projectName: getProjectName(rootPath),
      rootPath,
      techStack,
      tree: scanResult.tree,
      keyFiles: scanResult.keyFiles,
      gitCommits,
      selectedFiles: [],
      mode: 'basic',
    });

    const fileUri = vscode.Uri.joinPath(rootUri, outputFileName);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(markdown, 'utf-8'));

    flashStatusBar('$(check) ContextFlow refreshed', `${outputFileName} updated`, 3000);
    vscode.window.showInformationMessage(`✅ ContextFlow: ${outputFileName} refreshed.`);

  } catch (err) {
    console.error('ContextFlow: Refresh failed:', err);
    flashStatusBar('$(warning) ContextFlow failed', String(err), 4000);
    vscode.window.showErrorMessage('ContextFlow: Failed to refresh context. Check logs.');
  }
}
```

### src/commands/showDiff.ts  _(83 lines)_
```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { getProjectName } from '../utils/techDetector';

let channel: vscode.OutputChannel | null = null;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('ContextFlow Diff');
  }
  return channel;
}

export async function showDiff(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders;
  if (!ws?.length) {
    vscode.window.showErrorMessage('ContextFlow: Open a project first.');
    return;
  }

  const root = ws[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('contextflow');
  const fileName = config.get<string>('outputFileName') ?? 'contextflow.md';
  const filePath = path.join(root, fileName);

  if (!fs.existsSync(filePath)) {
    vscode.window.showWarningMessage('ContextFlow: Generate context first.');
    return;
  }

  const ch = getChannel();
  ch.clear();
  ch.show(true);

  const oldContent = fs.readFileSync(filePath, 'utf-8');

  const oldFiles = new Set(
    oldContent
      .split('\n')
      .map(l => l.match(/[├└]── (.+)$/))
      .filter(Boolean)
      .map(m => m![1].trim())
      .filter(f => !f.endsWith('/'))
  );

  const scan = scanWorkspace(root);
  const currentFiles = new Set(
    scan.allFiles.map(f => path.relative(root, f).replace(/\\/g, '/'))
  );

  const newFiles: string[] = [];
  const deletedFiles: string[] = [];

  for (const f of currentFiles) {
    if (!oldFiles.has(path.basename(f))) newFiles.push(f);
  }

  for (const f of oldFiles) {
    const exists = Array.from(currentFiles).some(cf => path.basename(cf) === f);
    if (!exists) deletedFiles.push(f);
  }

  ch.appendLine('==== CONTEXTFLOW DIFF ====');
  ch.appendLine(`Project: ${getProjectName(root)}\n`);

  if (newFiles.length) {
    ch.appendLine('NEW FILES:');
    newFiles.slice(0, 50).forEach(f => ch.appendLine(`+ ${f}`));
    ch.appendLine('');
  }

  if (deletedFiles.length) {
    ch.appendLine('DELETED FILES:');
    deletedFiles.slice(0, 50).forEach(f => ch.appendLine(`- ${f}`));
    ch.appendLine('');
  }

  if (!newFiles.length && !deletedFiles.length) {
    ch.appendLine('No changes detected.');
  }
}
```

### src/providers/filePickerProvider.ts  _(177 lines)_
```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getIgnoredFolders, getMaxDepth } from '../utils/folderScanner';
import { isBinaryOrLockFile } from '../utils/markdownBuilder';

export class FileItem extends vscode.TreeItem {
  children: FileItem[] = [];
  isChecked = false;

  constructor(
    public readonly absolutePath: string,
    public readonly isDirectory: boolean,
    label: string,
    state: vscode.TreeItemCollapsibleState
  ) {
    super(label, state);
    this.command = isDirectory
      ? undefined
      : { command: 'contextflow.toggleFile', title: 'Toggle', arguments: [this] };
    this.updateUI();
  }

  updateUI(): void {
    if (this.isDirectory) {
      this.iconPath = new vscode.ThemeIcon(this.isChecked ? 'folder-opened' : 'folder');
      this.description = this.isChecked ? '✓' : '';
    } else {
      this.iconPath = new vscode.ThemeIcon(this.isChecked ? 'check' : 'file');
      this.description = this.isChecked ? '✓' : '';
    }
    this.tooltip = this.isChecked
      ? `${this.label} — included in context`
      : `${this.label} — click to include`;
  }
}

export class FilePickerProvider implements vscode.TreeDataProvider<FileItem> {
  private _change = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._change.event;

  private selected = new Set<string>();
  private roots: FileItem[] = [];

  constructor(private root: string) {}

  refresh(): void {
    this.roots = [];
    this._change.fire();
  }

  getTreeItem(e: FileItem): FileItem {
    return e;
  }

  getChildren(e?: FileItem): FileItem[] {
    if (!e) {
      if (!this.roots.length) {
        this.roots = this.build(this.root, 0);
      }
      return this.roots;
    }
    return e.children;
  }

  toggle(item: FileItem): void {
    if (item.isDirectory) {
      this.setDir(item, !item.isChecked);
    } else {
      item.isChecked = !item.isChecked;
      item.isChecked
        ? this.selected.add(item.absolutePath)
        : this.selected.delete(item.absolutePath);
      item.updateUI();
    }
    this._change.fire();
  }

  selectAll(): void {
    this.setAll(this.roots, true);
    this._change.fire();
  }

  deselectAll(): void {
    this.selected.clear();
    this.setAll(this.roots, false);
    this._change.fire();
  }

  getSelected(): string[] {
    return Array.from(this.selected).filter(p => {
      try { return fs.statSync(p).isFile(); } catch { return false; }
    });
  }

  getSelectedCount(): number {
    return this.selected.size;
  }

  private setDir(item: FileItem, checked: boolean): void {
    item.isChecked = checked;
    item.updateUI();
    for (const child of item.children) {
      if (child.isDirectory) {
        this.setDir(child, checked);
      } else {
        if (isBinaryOrLockFile(child.absolutePath)) continue;
        child.isChecked = checked;
        checked
          ? this.selected.add(child.absolutePath)
          : this.selected.delete(child.absolutePath);
        child.updateUI();
      }
    }
  }

  private setAll(items: FileItem[], checked: boolean): void {
    for (const item of items) {
      if (item.isDirectory) {
        item.isChecked = checked;
        item.updateUI();
        this.setAll(item.children, checked);
      } else {
        if (isBinaryOrLockFile(item.absolutePath)) continue;
        item.isChecked = checked;
        checked
          ? this.selected.add(item.absolutePath)
          : this.selected.delete(item.absolutePath);
        item.updateUI();
      }
    }
  }

  private build(dir: string, depth: number): FileItem[] {
    if (depth > getMaxDepth()) return [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    entries.sort((a, b) => {
      if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
      return a.isDirectory() ? -1 : 1;
    });

    const items: FileItem[] = [];

    for (const e of entries) {
      if (getIgnoredFolders().includes(e.name)) continue;
      if (e.name.startsWith('.') && e.name !== '.gitignore' && !e.name.startsWith('.env')) continue;

      const full = path.join(dir, e.name);

      if (e.isDirectory()) {
        const item = new FileItem(full, true, e.name, vscode.TreeItemCollapsibleState.Collapsed);
        item.children = this.build(full, depth + 1);
        items.push(item);
      } else {
        const item = new FileItem(full, false, e.name, vscode.TreeItemCollapsibleState.None);

        if (isBinaryOrLockFile(full)) {
          item.iconPath = new vscode.ThemeIcon('circle-slash');
          item.description = 'skipped — binary';
          item.tooltip = 'Binary or lock file — automatically skipped';
          item.command = undefined;
        }

        items.push(item);
      }
    }

    return items;
  }
}
```

### src/ui/SidebarPanelProvider.ts  _(320 lines)_
```typescript
import * as vscode from 'vscode';

export class SidebarPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'contextflowSidebar';

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
    };

    // ✅ Convert local image path to webview-safe URI
    const iconUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        'images',
        'icon.ico'
      )
    );

    webviewView.webview.html = this.getHtml(iconUri);

    webviewView.webview.onDidReceiveMessage((msg) => {
      vscode.commands.executeCommand(`contextflow.${msg.command}`);
    });
  }

  private getHtml(iconUri: vscode.Uri): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ContextFlow</title>

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

    .btn-basic {
      border-left: 2px solid #4f8eff;
    }

    .btn-tree {
      border-left: 2px solid #3ecf8e;
    }

    .btn-full {
      border-left: 2px solid #f97316;
    }

    /* Divider */
    .divider {
      height: 1px;
      background: var(--vscode-widget-border, #333);
      margin: 6px 0;
    }

    /* Small buttons */
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
      0%, 100% {
        opacity: 1;
      }

      50% {
        opacity: 0.3;
      }
    }

    .status-text {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>

<body>

  <!-- Header -->
  <div class="header">
    <img src="${iconUri}" alt="Logo" class="logo">

    <div class="header-text">
      <span class="title">ContextFlow</span>
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
    <span class="status-text">ready · contextflow.md</span>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function send(cmd) {
      vscode.postMessage({
        command: cmd
      });
    }
  </script>

</body>
</html>`;
  }
}
```

### src/ui/webviewPanel.ts  _(72 lines)_
```typescript
import * as vscode from 'vscode';

export function opencontextflowPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'contextflowPanel',
    'ContextFlow',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getHtml();

  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.command) {
      case 'basic':
        vscode.commands.executeCommand('contextflow.generateBasic');
        break;
      case 'tree':
        vscode.commands.executeCommand('contextflow.generateTree');
        break;
      case 'full':
        vscode.commands.executeCommand('contextflow.generateFull');
        break;
    }
  });
}

function getHtml(): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        font-family: sans-serif;
        padding: 20px;
        background: #1e1e1e;
        color: white;
      }
      button {
        width: 100%;
        padding: 20px;
        margin: 10px 0;
        font-size: 18px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
      }
      .basic { background: #007acc; }
      .tree { background: #388a34; }
      .full { background: #a31515; }
    </style>
  </head>
  <body>

    <h2>ContextFlow</h2>

    <button class="basic" onclick="send('basic')">⚡ Generate Basic</button>
    <button class="tree" onclick="send('tree')">🌳 Generate Tree</button>
    <button class="full" onclick="send('full')">📄 Generate Full</button>

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
```

### src/utils/fileWatcher.ts  _(71 lines)_
```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function registerFileWatcher(
  context: vscode.ExtensionContext,
  statusBar: vscode.StatusBarItem,
  onRefresh: () => Promise<void>
): vscode.Disposable {

  const disposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    const config = vscode.workspace.getConfiguration('contextflow');
    const autoRefresh = config.get<boolean>('autoRefreshOnSave') ?? false;

    if (!autoRefresh) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const outputFileName = config.get<string>('outputFileName') ?? 'contextflow.md';
    const outputFilePath = path.join(rootPath, outputFileName);

    if (doc.uri.fsPath === outputFilePath) return;
    if (!fs.existsSync(outputFilePath)) return;

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      try {
        await onRefresh();
        showUpdateMessage(statusBar, outputFileName);
      } catch {
        // Silent failure for auto-refresh
      }
    }, 2000);
  });

  context.subscriptions.push(disposable);
  return disposable;
}

function showUpdateMessage(statusBar: vscode.StatusBarItem, fileName: string): void {
  const originalText = statusBar.text;
  const originalTooltip = statusBar.tooltip;

  statusBar.text = '$(sync~spin) ContextFlow updating...';
  statusBar.tooltip = `Regenerating ${fileName}...`;

  setTimeout(() => {
    statusBar.text = '$(check) ContextFlow updated';
    statusBar.tooltip = `${fileName} was regenerated`;

    setTimeout(() => {
      statusBar.text = originalText;
      statusBar.tooltip = originalTooltip instanceof vscode.MarkdownString
        ? originalTooltip
        : originalTooltip ?? 'Open ContextFlow panel';
    }, 3000);
  }, 1500);
}

export function disposeFileWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
```

### src/utils/folderScanner.ts  _(137 lines)_
```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface FolderNode {
  name: string;
  isDirectory: boolean;
  children?: FolderNode[];
  relativePath: string;
}

export interface ScanResult {
  tree: FolderNode[];
  allFiles: string[]; // ✅ restored
  keyFiles: string[];
  totalFileCount: number;
}

const KEY_FILES = new Set([
  'package.json', 'tsconfig.json', 'Dockerfile',
  'docker-compose.yml', 'README.md', '.gitignore'
]);

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.mp4', '.mp3', '.zip', '.exe'
]);

export function getIgnoredFolders(): string[] {
  const config = vscode.workspace.getConfiguration('contextflow'); // ✅ fixed
  return config.get<string[]>('ignoredFolders') ?? [
    'node_modules', '.git', 'dist', 'build', '.next', 'out'
  ];
}

export function getMaxDepth(): number {
  const config = vscode.workspace.getConfiguration('contextflow'); // ✅ fixed
  return config.get<number>('maxDepth') ?? 4;
}

export function scanWorkspace(rootPath: string): ScanResult {
  const ignoredFolders = getIgnoredFolders();
  const maxDepth = getMaxDepth();

  const allFiles: string[] = [];
  const keyFiles: string[] = [];
  let totalFileCount = 0;

  function buildTree(dir: string, depth: number): FolderNode[] {
    if (depth > maxDepth) {
      return [{
        name: '...',
        isDirectory: true,
        relativePath: ''
      }];
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const nodes: FolderNode[] = [];

    for (const entry of entries) {
      if (ignoredFolders.includes(entry.name)) continue;

      const full = path.join(dir, entry.name);
      const rel = path.relative(rootPath, full).replace(/\\/g, '/');

      if (entry.name.startsWith('.') && !KEY_FILES.has(entry.name)) continue;

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          isDirectory: true,
          children: buildTree(full, depth + 1),
          relativePath: rel
        });

      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SKIP_EXTENSIONS.has(ext)) continue;

        totalFileCount++;
        allFiles.push(full);

        if (KEY_FILES.has(entry.name)) {
          keyFiles.push(rel);
        }

        nodes.push({
          name: entry.name,
          isDirectory: false,
          relativePath: rel
        });
      }
    }

    return nodes;
  }

  return {
    tree: buildTree(rootPath, 0),
    allFiles,
    keyFiles,
    totalFileCount
  };
}

export function renderTree(nodes: FolderNode[], prefix = ''): string {
  let result = '';

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;

    const connector = isLast ? '└── ' : '├── ';
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');

    result += `${prefix}${connector}${node.name}${node.isDirectory ? '/' : ''}\n`;

    if (node.isDirectory && node.children) {
      result += renderTree(node.children, nextPrefix);
    }
  }

  return result;
}
```

### src/utils/gitHelper.ts  _(127 lines)_
```typescript
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as vscode from 'vscode';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitCommit {
  hash: string;
  author: string;
  relativeDate: string;
  message: string;
}

/** Check if git repo exists */
export function hasGitRepo(rootPath: string): boolean {
  return fs.existsSync(path.join(rootPath, '.git'));
}

/** Get git history (async + safe) */
export async function getGitHistory(
  rootPath: string,
  count?: number
): Promise<GitCommit[]> {

  if (!hasGitRepo(rootPath)) return [];

  const config = vscode.workspace.getConfiguration('contextflow');
  const logCount = count ?? config.get<number>('gitLogCount') ?? 10;

  try {
    const format = '%h|%an|%ar|%s';
    const command = `git log --pretty=format:"${format}" -${logCount}`;

    const { stdout } = await execAsync(command, {
      cwd: rootPath,
      timeout: 5000
    });

    return stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, author, relativeDate, ...msg] = line.split('|');
        return {
          hash: hash?.trim(),
          author: author?.trim(),
          relativeDate: relativeDate?.trim(),
          message: msg.join('|').trim()
        };
      });

  } catch {
    return [];
  }
}

/** Get current branch */
export async function getCurrentBranch(rootPath: string): Promise<string | null> {
  if (!hasGitRepo(rootPath)) return null;

  try {
    const { stdout } = await execAsync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: rootPath }
    );
    return stdout.trim();
  } catch {
    return null;
  }
}

/** Get changed files */
export async function getGitStatus(
  rootPath: string
): Promise<Array<{ status: string; file: string }>> {

  if (!hasGitRepo(rootPath)) return [];

  try {
    const { stdout } = await execAsync(
      'git status --porcelain',
      { cwd: rootPath }
    );

    return stdout
      .split('\n')
      .filter(Boolean)
      .map(line => ({
        status: line.slice(0, 2).trim(),
        file: line.slice(3).trim()
      }));

  } catch {
    return [];
  }
}

/** 🔥 NEW: Analyze commits for insights */
export function analyzeGitCommits(commits: GitCommit[]): string[] {
  const insights: string[] = [];

  const messages = commits.map(c => c.message.toLowerCase());

  const hasUI = messages.some(m =>
    m.includes('ui') || m.includes('css') || m.includes('page')
  );

  const hasFeature = messages.some(m =>
    m.includes('add') || m.includes('feature')
  );

  const hasFix = messages.some(m =>
    m.includes('fix') || m.includes('bug')
  );

  if (hasUI) insights.push('Recent changes focus on UI/frontend');
  if (hasFeature) insights.push('New features are being added');
  if (hasFix) insights.push('Bug fixes and improvements detected');

  if (insights.length === 0) {
    insights.push('General development activity detected');
  }

  return insights;
}
```

### src/utils/markdownBuilder.ts  _(628 lines)_
```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TechStack, getNpmScripts, getEnvKeys } from './techDetector';
import { FolderNode, renderTree } from './folderScanner';
import { GitCommit } from './gitHelper';

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.avif',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm', '.mkv', '.ogg',
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.db', '.sqlite', '.sqlite3',
  '.glb', '.gltf', '.fbx', '.obj',
  '.psd', '.ai', '.sketch', '.fig',
  '.class', '.jar', '.pyc', '.o', '.a',
  '.bin', '.dat', '.iso', '.svg',
]);

const LOCK_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Cargo.lock', 'poetry.lock', 'composer.lock', 'Gemfile.lock',
]);

const IGNORE_IN_TREE = new Set([
  'contextflow.md', 'aibridge.md', 'project.ai.md', '.gitignore', '.env',
  'vercel.json', 'netlify.toml', '.eslintrc.json', '.prettierrc',
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024;

export type GenerateMode = 'basic' | 'tree' | 'full';

export function isBinaryOrLockFile(filePath: string): boolean {
  return (
    BINARY_EXT.has(path.extname(filePath).toLowerCase()) ||
    LOCK_FILES.has(path.basename(filePath))
  );
}

function isFileTooLarge(filePath: string): boolean {
  try { return fs.statSync(filePath).size > MAX_FILE_SIZE_BYTES; }
  catch { return true; }
}

function hasBinaryContent(buffer: Buffer): boolean {
  const sample = buffer.slice(0, 512);
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b === 0) return true;
    if (b < 8 || (b > 13 && b < 32 && b !== 27)) bad++;
  }
  return bad / sample.length > 0.1;
}

function getLang(filePath: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'tsx',
    '.js': 'javascript', '.jsx': 'jsx', '.mjs': 'javascript',
    '.json': 'json', '.md': 'markdown',
    '.html': 'html', '.htm': 'html',
    '.css': 'css', '.scss': 'scss', '.sass': 'sass', '.less': 'less',
    '.py': 'python', '.go': 'go', '.rs': 'rust',
    '.java': 'java', '.rb': 'ruby', '.php': 'php',
    '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
    '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
    '.sql': 'sql', '.graphql': 'graphql', '.prisma': 'prisma', '.env': 'bash',
  };
  const base = path.basename(filePath).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  return map[path.extname(filePath).toLowerCase()] ?? '';
}

function readSafe(fp: string): { content: string; error: string | null } {
  if (isBinaryOrLockFile(fp)) return { content: '', error: 'binary or lock file' };
  if (isFileTooLarge(fp)) return { content: '', error: 'file too large (over 50KB)' };
  let buf: Buffer;
  try { buf = fs.readFileSync(fp); }
  catch { return { content: '', error: 'could not read file' }; }
  if (hasBinaryContent(buf)) return { content: '', error: 'binary content detected' };
  return { content: buf.toString('utf-8'), error: null };
}

function getFileMeta(fp: string): { lines: number; sizeKb: string } {
  try {
    const content = fs.readFileSync(fp, 'utf-8');
    return {
      lines: content.split('\n').length,
      sizeKb: (fs.statSync(fp).size / 1024).toFixed(1),
    };
  } catch { return { lines: 0, sizeKb: '?' }; }
}

function detectDeps(fp: string): string[] {
  const { content, error } = readSafe(fp);
  if (error) return [];

  const deps: string[] = [];
  const ext = path.extname(fp).toLowerCase();
  const lines = content.split('\n').slice(0, 60);

  for (const line of lines) {
    const htmlMatch = line.match(/(?:href|src)=["']([^"'#?]+)["']/);
    if (htmlMatch) {
      const val = htmlMatch[1].trim();
      if (val.startsWith('http')) {
        const cdn = val.match(/\/([a-zA-Z0-9-]+)[@/]/);
        if (cdn) deps.push(`${cdn[1]} (CDN)`);
      } else if (val && !val.startsWith('data:')) {
        deps.push(val.replace(/^\.\.?\//, ''));
      }
      continue;
    }

    if (['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(ext)) {
      const imp = line.match(/(?:from|require)\s*\(?\s*['"]([^'"]+)['"]/);
      if (imp) {
        const val = imp[1];
        if (val.startsWith('.')) deps.push(val.replace(/^\.\.?\//, ''));
        else deps.push(`${val} (pkg)`);
      }
    }

    if (['.css', '.scss', '.sass'].includes(ext)) {
      const imp = line.match(/@import\s+['"]([^'"]+)['"]/);
      if (imp) deps.push(imp[1].replace(/^\.\.?\//, ''));
    }
  }

  return [...new Set(deps)].slice(0, 8);
}

interface ApiEndpoint {
  method: string;
  path: string;
  handler: string;
  file: string;
}

function extractEndpoints(fp: string, rootPath: string): ApiEndpoint[] {
  const { content, error } = readSafe(fp);
  if (error) return [];

  const endpoints: ApiEndpoint[] = [];
  const rel = path.relative(rootPath, fp).replace(/\\/g, '/');
  const lines = content.split('\n');

  const fileName = path.basename(fp, path.extname(fp));
  const basePath = fileName
    .replace('Routes', '').replace('routes', '').replace('Router', '').toLowerCase();

  for (const line of lines) {
    const match = line.match(
      /router\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/i
    );
    if (match) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      const handlerMatch = line.match(/,\s*(?:\w+\.)?(\w+)\s*[,)]/);
      const handler = handlerMatch ? handlerMatch[1] : '';
      endpoints.push({
        method,
        path: `/${basePath}${routePath === '/' ? '' : routePath}`,
        handler,
        file: rel,
      });
    }
  }

  return endpoints;
}

interface ImportantFile {
  path: string;
  role: string;
  why: string;
  lines: number;
}

function analyzeImportantFiles(selectedFiles: string[], rootPath: string): ImportantFile[] {
  const important: ImportantFile[] = [];

  const roleMap: Array<{ pattern: RegExp; role: string; why: (name: string) => string }> = [
    { pattern: /controller/i, role: 'Controller', why: (n) => `Handles business logic for ${n.replace(/controller/i, '').replace(/\./, '')} operations` },
    { pattern: /middleware/i, role: 'Middleware', why: (n) => `Intercepts requests — ${n.includes('auth') ? 'verifies JWT tokens and protects routes' : n.includes('error') ? 'handles errors globally' : 'validates or transforms requests'}` },
    { pattern: /model/i, role: 'Model', why: (n) => `Defines ${n.replace(/\.(js|ts)$/, '')} database schema and shape` },
    { pattern: /route/i, role: 'Router', why: (n) => `Maps HTTP endpoints to ${n.replace(/routes?\.(js|ts)$/, '').replace(/\./, '')} controller functions` },
    { pattern: /server\.(js|ts)$/i, role: 'Entry Point', why: () => 'App entry — initializes Express, loads middleware, connects DB, starts server' },
    { pattern: /index\.(js|ts)$/i, role: 'App Root', why: () => 'Registers all routes and global middleware onto the Express app' },
    { pattern: /db\.(js|ts)$/i, role: 'Database', why: () => 'Manages database connection — called once at startup' },
    { pattern: /auth/i, role: 'Auth', why: (n) => `Core authentication — ${n.includes('controller') ? 'handles login/register/logout' : n.includes('middleware') ? 'protects private routes with JWT' : 'auth utilities'}` },
    { pattern: /token/i, role: 'Utility', why: () => 'Generates and signs JWT tokens for authenticated sessions' },
    { pattern: /response|apiResponse/i, role: 'Utility', why: () => 'Standardizes all API responses — used by every controller' },
  ];

  for (const fp of selectedFiles) {
    const base = path.basename(fp);
    if (IGNORE_IN_TREE.has(base) || LOCK_FILES.has(base)) continue;
    if (isBinaryOrLockFile(fp)) continue;

    const meta = getFileMeta(fp);
    const rel = path.relative(rootPath, fp).replace(/\\/g, '/');

    for (const rule of roleMap) {
      if (rule.pattern.test(base)) {
        important.push({ path: rel, role: rule.role, why: rule.why(base), lines: meta.lines });
        break;
      }
    }
  }

  const rolePriority: Record<string, number> = {
    'Entry Point': 1, 'App Root': 2, 'Database': 3, 'Auth': 4,
    'Controller': 5, 'Router': 6, 'Middleware': 7, 'Model': 8, 'Utility': 9,
  };

  return important
    .sort((a, b) => (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99))
    .slice(0, 10);
}

function detectBusinessFlow(selectedFiles: string[], techStack: TechStack | null): string {
  const names = selectedFiles.map(f => path.basename(f).toLowerCase());
  const has = (k: string) => names.some(f => f.includes(k));

  const steps: string[] = [];
  if (has('auth') || has('user')) steps.push('User registers / logs in');
  if (has('product') || has('food')) steps.push('Browse items');
  if (has('cart')) steps.push('Add to cart');
  if (has('order')) steps.push('Place order');

  if (steps.length === 0) {
    return 'Client sends request → Middleware validates → Controller processes → Response returned';
  }

  return steps.join(' → ');
}

interface DepInsight { file: string; dependsOn: string[]; reason: string; }

function buildDepInsights(selectedFiles: string[], rootPath: string): DepInsight[] {
  const insights: DepInsight[] = [];

  for (const fp of selectedFiles) {
    const base = path.basename(fp).toLowerCase();
    const rel = path.relative(rootPath, fp).replace(/\\/g, '/');

    if (!base.includes('controller') && !base.includes('route')) continue;
    if (isBinaryOrLockFile(fp)) continue;

    const deps = detectDeps(fp).filter(d => !d.includes('(pkg)') && !d.includes('(CDN)'));
    if (deps.length === 0) continue;

    const isController = base.includes('controller');
    const isRoute = base.includes('route');
    let reason = '';
    if (isController) reason = `Needs ${deps.map(d => path.basename(d)).join(', ')} to read/write data and send responses`;
    else if (isRoute) reason = `Connects HTTP endpoints to ${deps.map(d => path.basename(d)).join(', ')}`;

    insights.push({ file: rel, dependsOn: deps, reason });
  }

  return insights.slice(0, 6);
}

interface TreeNode { name: string; children: Map<string, TreeNode>; fullPath?: string; }

function buildTree(paths: string[], rootPath: string): TreeNode {
  const root: TreeNode = { name: path.basename(rootPath), children: new Map() };

  for (const relPath of paths) {
    const parts = relPath.split('/');
    let current = root;
    let currentFullPath = rootPath;

    for (const part of parts) {
      currentFullPath = path.join(currentFullPath, part);
      if (!current.children.has(part)) {
        current.children.set(part, { name: part, children: new Map(), fullPath: currentFullPath });
      }
      current = current.children.get(part)!;
    }
  }

  return root;
}

function cleanDep(dep: string): string {
  return dep.replace(/\s*\(pkg\)|\s*\(CDN\)/g, '');
}

function renderTreePretty(node: TreeNode, prefix = '', isLast = true, isRoot = false): string[] {
  const lines: string[] = [];

  if (isRoot) {
    lines.push(node.name + '/');
  } else {
    const connector = isLast ? '└── ' : '├── ';
    if (node.fullPath && !node.children.size) {
      const meta = getFileMeta(node.fullPath);
      lines.push(`${prefix}${connector}${node.name} (${meta.lines} lines, ${meta.sizeKb} KB)`);
    } else {
      lines.push(prefix + connector + node.name);
    }
  }

  const newPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
  const children = Array.from(node.children.values());

  children.forEach((child, index) => {
    const last = index === children.length - 1;
    lines.push(...renderTreePretty(child, newPrefix, last, false));

    if (child.fullPath && !child.children.size) {
      const deps = detectDeps(child.fullPath).map(cleanDep);
      if (deps.length === 0) {
        lines.push(newPrefix + (last ? '    ' : '│   ') + '└── (no external dependencies)');
      } else {
        deps.forEach((dep, i) => {
          const depPrefix = newPrefix + (last ? '    ' : '│   ') + (i === deps.length - 1 ? '└── ' : '├── ');
          lines.push(depPrefix + 'uses → ' + dep);
        });
      }
    }
  });

  return lines;
}

function buildArchitectureTree(selectedFiles: string[], rootPath: string, gitCommits: GitCommit[]): string[] {
  const lines: string[] = [];
  lines.push('## 🌳 Project Architecture Tree\n');
  lines.push('```');

  const relPaths = selectedFiles
    .filter(fp => {
      const base = path.basename(fp);
      return !IGNORE_IN_TREE.has(base) && !LOCK_FILES.has(base) && !isBinaryOrLockFile(fp);
    })
    .map(fp => path.relative(rootPath, fp).replace(/\\/g, '/'));

  const tree = buildTree(relPaths, rootPath);
  lines.push(...renderTreePretty(tree, '', true, true));
  lines.push('```\n');

  lines.push('## 🕐 Last 5 Commits\n');
  if (gitCommits.length) {
    gitCommits.slice(0, 5).forEach(c => {
      lines.push(`- \`${c.hash}\` | ${c.author} | ${c.relativeDate} | ${c.message}`);
    });
  } else {
    lines.push('_No git history found._');
  }
  lines.push('');

  return lines;
}

export interface MarkdownInput {
  projectName: string;
  rootPath: string;
  techStack: TechStack | null;
  tree: FolderNode[];
  keyFiles: string[];
  gitCommits: GitCommit[];
  selectedFiles: string[];
  treeFlat?: string[];
  mode: GenerateMode;
}

function generateSmartOverview(input: MarkdownInput): string[] {
  const lines: string[] = [];
  const ts = input.techStack;
  const project = input.projectName;
  const files = input.treeFlat ?? [];
  const names = files.map(f => path.basename(f).toLowerCase());
  const has = (k: string) => names.some(f => f.includes(k));

  let desc = `**${project}**`;

  if (ts?.backend.length) {
    desc += ` is a backend API built with ${ts.backend.join(', ')}`;
    if (ts.database.length) desc += ` and ${ts.database.join(', ')}`;
    desc += `.`;
  } else if (ts?.frontend.length) {
    desc += ` is a frontend application built with ${ts.frontend.join(', ')}.`;
  } else {
    desc += ` is a ${ts?.languages.join(', ') || 'software'} project.`;
  }

  lines.push(desc);
  return lines;
}

export function buildMarkdown(input: MarkdownInput): string {
  const cfg = vscode.workspace.getConfiguration('contextflow');
  const now = new Date().toLocaleString();
  const lines: string[] = [];

  const modeLabel: Record<GenerateMode, string> = {
    basic: '⚡ Basic',
    tree: '🌳 Project Tree',
    full: '📄 Full Code',
  };

  lines.push(`# ContextFlow — ${input.projectName}`);
  lines.push(`> Generated on ${now}  |  Mode: ${modeLabel[input.mode]}`);
  lines.push(`> Paste into ChatGPT, Claude, Gemini, or any AI tool.\n`);
  lines.push('---\n');

  lines.push('## 📋 Project Overview\n');
  lines.push(...generateSmartOverview(input));
  lines.push('');

  if (input.techStack) {
    const isBackend = input.techStack.backend.length > 0;
    const hasStripe = input.techStack.other.includes('Stripe');
    const hasAuth = input.techStack.other.includes('JWT');
    const isFrontend = input.techStack.frontend.length > 0;

    let overview = `**${input.projectName}**`;

    if (isBackend && isFrontend) {
      overview += ` is a full-stack application built with ${[...input.techStack.frontend, ...input.techStack.backend].slice(0, 3).join(', ')}.`;
    } else if (isBackend) {
      overview += ` is a backend REST API built with ${input.techStack.backend.join(', ')}`;
      if (input.techStack.database.length) overview += ` and ${input.techStack.database.join(', ')}`;
      overview += '.';
    } else if (isFrontend) {
      overview += ` is a frontend application built with ${input.techStack.frontend.join(', ')}.`;
    } else {
      overview += ` is a ${input.techStack.languages.join(', ')} project.`;
    }

    lines.push(overview);

    const fileNames = input.selectedFiles.map(f => path.basename(f).toLowerCase());
    const has = (k: string) => fileNames.some(f => f.includes(k));

    if (has('order') && has('food')) {
      lines.push('It powers a **food ordering platform** — handling restaurants, menus, cart, orders' + (hasStripe ? ', and payments' : '') + '.');
    } else if (has('order') && has('product')) {
      lines.push('It powers an **e-commerce platform** — handling products, cart, orders' + (hasStripe ? ', and payments' : '') + '.');
    } else if (has('auth') && hasAuth) {
      lines.push('It includes a full **authentication system** using JWT tokens for secure session management.');
    }

    if (hasAuth) lines.push('Protected routes use JWT-based authentication middleware.');
  } else {
    lines.push(`**${input.projectName}** — static project.`);
  }
  lines.push('');

  lines.push('## 🏗 Core Architecture\n');
  if (input.techStack?.backend.length) {
    const fileNames = input.selectedFiles.map(f => path.basename(f).toLowerCase());
    const has = (k: string) => fileNames.some(f => f.includes(k));
    const layers: Array<{ name: string; desc: string }> = [];
    if (has('route')) layers.push({ name: 'Routes', desc: 'Define HTTP endpoints and map them to controller functions' });
    if (has('controller')) layers.push({ name: 'Controllers', desc: 'Handle request logic — validate input, call models, return responses' });
    if (has('middleware')) layers.push({ name: 'Middleware', desc: 'Intercept requests — handle auth, roles, validation, errors' });
    if (has('model')) layers.push({ name: 'Models', desc: 'Define database schemas and interact with the database' });
    if (has('util') || has('helper')) layers.push({ name: 'Utils', desc: 'Shared helpers — token generation, response formatting, etc.' });
    if (has('config')) layers.push({ name: 'Config', desc: 'Database connection and app-level configuration' });

    if (layers.length > 0) {
      layers.forEach(l => lines.push(`- **${l.name}** — ${l.desc}`));
    } else {
      lines.push('- Standard MVC pattern — routes, controllers, models');
    }
  } else {
    lines.push('- Static project — no server-side architecture detected');
  }
  lines.push('');

  const routeFiles = input.selectedFiles.filter(fp =>
    path.basename(fp).toLowerCase().includes('route') && !isBinaryOrLockFile(fp)
  );

  if (routeFiles.length > 0) {
    lines.push('## 🔌 API Endpoints\n');
    const allEndpoints: ApiEndpoint[] = [];
    for (const fp of routeFiles) allEndpoints.push(...extractEndpoints(fp, input.rootPath));

    if (allEndpoints.length > 0) {
      const groups = new Map<string, ApiEndpoint[]>();
      for (const ep of allEndpoints) {
        const base = ep.path.split('/')[1] ?? 'root';
        if (!groups.has(base)) groups.set(base, []);
        groups.get(base)!.push(ep);
      }
      for (const [group, eps] of groups) {
        lines.push(`**/${group}**`);
        for (const ep of eps) {
          const handlerNote = ep.handler ? ` → ${ep.handler}` : '';
          lines.push(`- \`${ep.method}\` \`${ep.path}\`${handlerNote}`);
        }
        lines.push('');
      }
    } else {
      lines.push('_Could not auto-detect endpoints. Check route files manually._\n');
    }
  }

  lines.push('## 🔄 Business Flow\n');
  lines.push(detectBusinessFlow(input.selectedFiles, input.techStack) + '\n');

  const importantFiles = analyzeImportantFiles(input.selectedFiles, input.rootPath);
  if (importantFiles.length > 0) {
    lines.push('## ⭐ Important Files\n');
    lines.push('| File | Role | Purpose |');
    lines.push('|---|---|---|');
    importantFiles.forEach(f =>
      lines.push(`| \`${path.basename(f.path)}\` | ${f.role} | ${f.why} |`)
    );
    lines.push('');
  }

  const insights = buildDepInsights(input.selectedFiles, input.rootPath);
  if (insights.length > 0) {
    lines.push('## 🔗 Dependency Insights\n');
    for (const ins of insights) lines.push(`- **${path.basename(ins.file)}** — ${ins.reason}`);
    lines.push('');
  }

  lines.push('## 🛠 Tech Stack\n');
  if (input.techStack) {
    const ts = input.techStack;
    if (ts.languages.length) lines.push(`- **Language:** ${ts.languages.join(', ')}`);
    if (ts.frontend.length) lines.push(`- **Frontend:** ${ts.frontend.join(', ')}`);
    if (ts.backend.length) lines.push(`- **Backend:** ${ts.backend.join(', ')}`);
    if (ts.database.length) lines.push(`- **Database:** ${ts.database.join(', ')}`);
    if (ts.testing.length) lines.push(`- **Testing:** ${ts.testing.join(', ')}`);
    if (ts.devTools.length) lines.push(`- **Dev Tools:** ${ts.devTools.join(', ')}`);
    if (ts.other.length) lines.push(`- **Other:** ${ts.other.join(', ')}`);
  } else {
    lines.push('- **Language:** HTML, CSS, JavaScript');
  }
  lines.push('');

  if (cfg.get<boolean>('includeScripts') !== false) {
    const scripts = Object.entries(getNpmScripts(input.rootPath));
    if (scripts.length) {
      lines.push('## 🔧 Available Scripts\n');
      scripts.forEach(([k, v]) => lines.push(`- \`${k}\` → ${v}`));
      lines.push('');
    }
  }

  if (cfg.get<boolean>('includeEnvKeys') !== false) {
    const keys = getEnvKeys(input.rootPath);
    if (keys.length) {
      lines.push('## 🌍 Environment Variables (keys only)\n');
      keys.forEach(k => lines.push(`- ${k}`));
      lines.push('');
    }
  }

  if (input.mode === 'basic') {
    lines.push('## 📁 Folder Structure\n');
    lines.push('```');
    lines.push(path.basename(input.rootPath) + '/');
    lines.push(renderTree(input.tree));
    lines.push('```\n');

    if (cfg.get<boolean>('includeGitHistory') !== false && input.gitCommits.length) {
      lines.push('## 🕐 Recent Git Activity\n');
      input.gitCommits.forEach(c =>
        lines.push(`- \`${c.hash}\` | ${c.author} | ${c.relativeDate} | ${c.message}`)
      );
      lines.push('');
    }

    if (input.selectedFiles.length) {
      lines.push('## 📎 Selected Files\n');
      lines.push('| File | Lines | Size |');
      lines.push('|---|---|---|');
      for (const fp of input.selectedFiles) {
        const rel = path.relative(input.rootPath, fp).replace(/\\/g, '/');
        if (isBinaryOrLockFile(fp)) { lines.push(`| \`${rel}\` | — | binary |`); continue; }
        const { lines: lc, sizeKb } = getFileMeta(fp);
        lines.push(`| \`${rel}\` | ${lc} | ${sizeKb} KB |`);
      }
      lines.push('');
      lines.push('> 💡 Ask the AI about any specific file and share its contents on request.\n');
    }

  } else if (input.mode === 'tree') {
    const allFiles = input.treeFlat ?? [];
    const files = allFiles.length > 0 ? allFiles : input.selectedFiles;
    lines.push(...buildArchitectureTree(files, input.rootPath, input.gitCommits));

  } else if (input.mode === 'full') {
    if (input.selectedFiles.length) {
      lines.push('## 📎 Selected Files — Full Code\n');
      for (const fp of input.selectedFiles) {
        const base = path.basename(fp);
        if (IGNORE_IN_TREE.has(base) || LOCK_FILES.has(base)) continue;

        const rel = path.relative(input.rootPath, fp).replace(/\\/g, '/');
        const { content, error } = readSafe(fp);

        if (error) { lines.push(`> ⚠️ Skipped \`${rel}\` — ${error}\n`); continue; }

        const meta = getFileMeta(fp);
        lines.push(`### ${rel}  _(${meta.lines} lines)_`);
        lines.push('```' + getLang(fp));
        lines.push(content);
        lines.push('```\n');
      }
    }

    if (cfg.get<boolean>('includeGitHistory') !== false && input.gitCommits.length) {
      lines.push('## 🕐 Recent Git Activity\n');
      input.gitCommits.forEach(c =>
        lines.push(`- \`${c.hash}\` | ${c.author} | ${c.relativeDate} | ${c.message}`)
      );
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`_Generated by ContextFlow — ${modeLabel[input.mode]} mode_`);

  return lines.join('\n');
}
```

### src/utils/techDetector.ts  _(332 lines)_
```typescript
import * as fs from 'fs';
import * as path from 'path';

/** Categorized tech stack detection result */
export interface TechStack {
  languages: string[];
  frontend: string[];
  backend: string[];
  database: string[];
  testing: string[];
  devTools: string[];
  other: string[];
}

/** Maps dependency name (regex or string) to a display label */
interface DepMapping {
  pattern: RegExp | string;
  label: string;
}

const FRONTEND_DEPS: DepMapping[] = [
  { pattern: 'react', label: 'React' },
  { pattern: 'vue', label: 'Vue.js' },
  { pattern: '@angular/core', label: 'Angular' },
  { pattern: 'svelte', label: 'Svelte' },
  { pattern: 'next', label: 'Next.js' },
  { pattern: 'nuxt', label: 'Nuxt' },
  { pattern: 'astro', label: 'Astro' },
  { pattern: '@remix-run/react', label: 'Remix' },
  { pattern: 'gatsby', label: 'Gatsby' },
  { pattern: 'tailwindcss', label: 'Tailwind CSS' },
  { pattern: '@mui/material', label: 'Material UI' },
  { pattern: 'antd', label: 'Ant Design' },
  { pattern: '@chakra-ui/react', label: 'Chakra UI' },
  { pattern: /^@radix-ui\//, label: 'shadcn/ui (Radix)' },
  { pattern: 'solid-js', label: 'SolidJS' },
  { pattern: 'qwik', label: 'Qwik' },
];

const BACKEND_DEPS: DepMapping[] = [
  { pattern: 'express', label: 'Express.js' },
  { pattern: 'fastify', label: 'Fastify' },
  { pattern: '@nestjs/core', label: 'NestJS' },
  { pattern: 'koa', label: 'Koa' },
  { pattern: 'hono', label: 'Hono' },
  { pattern: '@hapi/hapi', label: 'Hapi' },
  { pattern: 'elysia', label: 'Elysia' },
];

const DATABASE_DEPS: DepMapping[] = [
  { pattern: 'mongoose', label: 'MongoDB (Mongoose)' },
  { pattern: 'mongodb', label: 'MongoDB' },
  { pattern: 'pg', label: 'PostgreSQL (pg)' },
  { pattern: 'mysql2', label: 'MySQL' },
  { pattern: 'mysql', label: 'MySQL' },
  { pattern: 'better-sqlite3', label: 'SQLite' },
  { pattern: 'sqlite3', label: 'SQLite' },
  { pattern: '@prisma/client', label: 'Prisma' },
  { pattern: 'typeorm', label: 'TypeORM' },
  { pattern: 'sequelize', label: 'Sequelize' },
  { pattern: 'drizzle-orm', label: 'Drizzle ORM' },
  { pattern: 'redis', label: 'Redis' },
  { pattern: 'ioredis', label: 'Redis (ioredis)' },
  { pattern: 'supabase', label: 'Supabase' },
];

const TESTING_DEPS: DepMapping[] = [
  { pattern: 'jest', label: 'Jest' },
  { pattern: 'vitest', label: 'Vitest' },
  { pattern: 'mocha', label: 'Mocha' },
  { pattern: 'cypress', label: 'Cypress' },
  { pattern: '@playwright/test', label: 'Playwright' },
  { pattern: '@testing-library/react', label: 'React Testing Library' },
  { pattern: 'chai', label: 'Chai' },
  { pattern: 'supertest', label: 'Supertest' },
];

const DEVTOOL_DEPS: DepMapping[] = [
  { pattern: 'typescript', label: 'TypeScript' },
  { pattern: 'eslint', label: 'ESLint' },
  { pattern: 'prettier', label: 'Prettier' },
  { pattern: 'vite', label: 'Vite' },
  { pattern: 'webpack', label: 'Webpack' },
  { pattern: 'esbuild', label: 'esbuild' },
  { pattern: 'turbo', label: 'Turborepo' },
  { pattern: 'nx', label: 'Nx' },
  { pattern: '@swc/core', label: 'SWC' },
  { pattern: 'rollup', label: 'Rollup' },
  { pattern: 'parcel', label: 'Parcel' },
];

const OTHER_DEPS: DepMapping[] = [
  { pattern: 'graphql', label: 'GraphQL' },
  { pattern: '@trpc/server', label: 'tRPC' },
  { pattern: 'zustand', label: 'Zustand' },
  { pattern: 'redux', label: 'Redux' },
  { pattern: '@reduxjs/toolkit', label: 'Redux Toolkit' },
  { pattern: 'socket.io', label: 'Socket.io' },
  { pattern: 'zod', label: 'Zod' },
  { pattern: 'axios', label: 'Axios' },
  { pattern: 'jsonwebtoken', label: 'JWT' },
  { pattern: 'stripe', label: 'Stripe' },
  { pattern: 'openai', label: 'OpenAI SDK' },
  { pattern: '@anthropic-ai/sdk', label: 'Anthropic SDK' },
];

/**
 * Check if a dependency name matches a mapping pattern.
 */
function matchesDep(depName: string, pattern: RegExp | string): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(depName);
  }
  return depName === pattern || depName.includes(pattern);
}

/**
 * Detect technologies from a list of dependency names.
 */
function detectFrom(deps: string[], mappings: DepMapping[]): string[] {
  const found = new Set<string>();
  for (const dep of deps) {
    for (const mapping of mappings) {
      if (matchesDep(dep, mapping.pattern)) {
        found.add(mapping.label);
        break;
      }
    }
  }
  return Array.from(found);
}

/**
 * Detect languages from file existence in the workspace root.
 */
function detectLanguages(rootPath: string, deps: string[]): string[] {
  const languages: string[] = [];

  // 🔥 Static frontend detection
try {
  const files = fs.readdirSync(rootPath);

  if (files.some(f => f.endsWith('.html'))) {
    if (!languages.includes('HTML')) languages.push('HTML');
  }

  if (files.some(f => f.endsWith('.css'))) {
    if (!languages.includes('CSS')) languages.push('CSS');
  }

  if (files.some(f => f.endsWith('.js'))) {
    if (!languages.includes('JavaScript')) {
      languages.push('JavaScript');
    }
  }
} catch {}

  // TypeScript: tsconfig.json or typescript in deps
  if (
    fs.existsSync(path.join(rootPath, 'tsconfig.json')) ||
    deps.includes('typescript')
  ) {
    languages.push('TypeScript');
  } else {
    // Check for JS
    if (fs.existsSync(path.join(rootPath, 'package.json'))) {
      languages.push('JavaScript');
    }
  }

  // Python
  if (
    fs.existsSync(path.join(rootPath, 'requirements.txt')) ||
    fs.existsSync(path.join(rootPath, 'pyproject.toml')) ||
    fs.existsSync(path.join(rootPath, 'setup.py'))
  ) {
    languages.push('Python');
  }

  // Go
  if (fs.existsSync(path.join(rootPath, 'go.mod'))) {
    languages.push('Go');
  }

  // Rust
  if (fs.existsSync(path.join(rootPath, 'Cargo.toml'))) {
    languages.push('Rust');
  }

  // Java
  if (
    fs.existsSync(path.join(rootPath, 'pom.xml')) ||
    fs.existsSync(path.join(rootPath, 'build.gradle'))
  ) {
    languages.push('Java');
  }

  // Ruby
  if (fs.existsSync(path.join(rootPath, 'Gemfile'))) {
    languages.push('Ruby');
  }

  // PHP
  if (fs.existsSync(path.join(rootPath, 'composer.json'))) {
    languages.push('PHP');
  }

  return languages;
}

/**
 * Detect Docker usage from file existence.
 */
function detectDocker(rootPath: string): boolean {
  return (
    fs.existsSync(path.join(rootPath, 'Dockerfile')) ||
    fs.existsSync(path.join(rootPath, 'docker-compose.yml')) ||
    fs.existsSync(path.join(rootPath, 'docker-compose.yaml'))
  );
}

/**
 * Auto-detect the full tech stack from the workspace root.
 * @param rootPath - Absolute path to the workspace root
 * @returns TechStack object with categorized technologies
 */
export function detectTechStack(rootPath: string): TechStack | null {
  const pkgPath = path.join(rootPath, 'package.json');

  

  let allDeps: string[] = [];
  let packageData: Record<string, unknown> = {};

  

  if (fs.existsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      packageData = JSON.parse(raw) as Record<string, unknown>;

      const deps = Object.keys((packageData.dependencies as Record<string, string>) ?? {});
      const devDeps = Object.keys((packageData.devDependencies as Record<string, string>) ?? {});
      const peerDeps = Object.keys((packageData.peerDependencies as Record<string, string>) ?? {});
      allDeps = [...deps, ...devDeps, ...peerDeps];
    } catch {
      // package.json parse error — continue with empty deps
    }
  }

  const languages = detectLanguages(rootPath, allDeps);
  const frontend = detectFrom(allDeps, FRONTEND_DEPS);
  const backend = detectFrom(allDeps, BACKEND_DEPS);
  const database = detectFrom(allDeps, DATABASE_DEPS);
  const testing = detectFrom(allDeps, TESTING_DEPS);
  const devTools = detectFrom(allDeps, DEVTOOL_DEPS);
  const other = detectFrom(allDeps, OTHER_DEPS);

  if (detectDocker(rootPath)) {
    other.push('Docker');
  }

  return { languages, frontend, backend, database, testing, devTools, other };
}

/**
 * Read npm scripts from package.json.
 * @param rootPath - Workspace root path
 * @returns Record of script name → command, or empty object
 */
export function getNpmScripts(rootPath: string): Record<string, string> {
  const pkgPath = path.join(rootPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};

  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    return (pkg.scripts as Record<string, string>) ?? {};
  } catch {
    return {};
  }
}

/**
 * Get the project name from package.json or the folder name.
 * @param rootPath - Workspace root path
 */
export function getProjectName(rootPath: string): string {
  const pkgPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      if (typeof pkg.name === 'string' && pkg.name.trim()) {
        return pkg.name.trim();
      }
    } catch {
      // fall through
    }
  }
  return path.basename(rootPath);
}

/**
 * Read environment variable keys from .env.example or .env.sample.
 * NEVER reads values — only returns key names.
 * @param rootPath - Workspace root path
 */
export function getEnvKeys(rootPath: string): string[] {
  const candidates = ['.env.example', '.env.sample', '.env.template'];
  for (const fname of candidates) {
    const envPath = path.join(rootPath, fname);
    if (!fs.existsSync(envPath)) continue;
    try {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      const keys: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          keys.push(trimmed.substring(0, eqIndex).trim());
        }
      }
      return keys;
    } catch {
      // continue to next candidate
    }
  }
  return [];
}

```

### src/extension.ts  _(154 lines)_
```typescript
import * as vscode from 'vscode';
import { generateContext } from './commands/generateContext';
import { copyContext } from './commands/copyContext';
import { refreshContext } from './commands/refreshContext';
import { showDiff } from './commands/showDiff';
import { FilePickerProvider, FileItem } from './providers/filePickerProvider';
import { createStatusBar } from './statusBar';
import { registerFileWatcher, disposeFileWatcher } from './utils/fileWatcher';
import { opencontextflowPanel } from './ui/webviewPanel';
import { SidebarPanelProvider } from './ui/SidebarPanelProvider';

export function activate(context: vscode.ExtensionContext): void {
  console.log('contextflow v2.0 activated.');

  const statusBar = createStatusBar(context);

  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const picker = new FilePickerProvider(rootPath);

  const provider = new SidebarPanelProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'contextflowSidebar',
      provider
    )
  );

  // 🌳 Tree View
  context.subscriptions.push(
    vscode.window.createTreeView('contextflowFiles', {
      treeDataProvider: picker,
      showCollapseAll: true,
    })
  );

  // ⚡ BASIC
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.generateBasic', async () => {
      await generateContext([], 'basic');
    })
  );

  // 🌳 TREE
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.generateTree', async () => {
      await generateContext([], 'tree');
    })
  );

  // 📄 FULL (requires selection)
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.generateFull', async () => {
      const files = picker.getSelected();

      if (files.length === 0) {
        vscode.window.showWarningMessage(
          'contextflow: Select files for Full mode.'
        );
        return;
      }

      await generateContext(files, 'full');
    })
  );

  // 📋 Copy
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.copy', async () => {
      await copyContext();
    })
  );

  // 🔄 Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.refresh', async () => {
      await refreshContext();
    })
  );

  // 🔍 Diff
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.showDiff', async () => {
      await showDiff();
    })
  );

  // 📁 File selection
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.toggleFile', (item: FileItem) => {
      picker.toggle(item);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.selectAll', () => {
      picker.selectAll();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.deselectAll', () => {
      picker.deselectAll();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.refreshFilePicker', () => {
      picker.refresh();
      vscode.window.showInformationMessage('contextflow: File list refreshed.');
    })
  );

  // 🚀 Webview Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.openPanel', () => {
      opencontextflowPanel(context);
    })
  );

  // 👀 File watcher
  registerFileWatcher(context, statusBar, async () => {
    await refreshContext();
  });

  // 🔁 Workspace change
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      picker.refresh();
    })
  );

  // 👋 Welcome message (updated)
  const shown = context.globalState.get<boolean>('contextflow.welcome');
  if (!shown) {
    vscode.window
      .showInformationMessage(
        '👋 contextflow is ready! Use sidebar buttons or open panel.',
        'Open Panel'
      )
      .then(answer => {
        if (answer === 'Open Panel') {
          vscode.commands.executeCommand('contextflow.openPanel');
        }
      });

    context.globalState.update('contextflow.welcome', true);
  }
}

export function deactivate(): void {
  disposeFileWatcher();
  console.log('contextflow deactivated.');
}
```

### src/statusBar.ts  _(39 lines)_
```typescript
import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem | null = null;

export function createStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  statusBarItem.text = '$(comment-discussion) ContextFlow';
  statusBarItem.tooltip = 'Open ContextFlow panel';
  statusBarItem.command = 'contextflow.openPanel';
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);
  return statusBarItem;
}

export function getStatusBar(): vscode.StatusBarItem | null {
  return statusBarItem;
}

export function flashStatusBar(text: string, tooltip: string, durationMs = 3000): void {
  if (!statusBarItem) return;

  const originalText = statusBarItem.text;
  const originalTooltip = statusBarItem.tooltip;

  statusBarItem.text = text;
  statusBarItem.tooltip = tooltip;

  setTimeout(() => {
    if (statusBarItem) {
      statusBarItem.text = originalText;
      statusBarItem.tooltip = originalTooltip;
    }
  }, durationMs);
}
```

> ⚠️ Skipped `aibridge-0.0.1.vsix` — file too large (over 50KB)

### LICENSE  _(22 lines)_
```
MIT License

Copyright (c) 2026 Nakum

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

### package.json  _(172 lines)_
```json
{
"name": "contextflow",
"displayName": "ContextFlow",
"description": "Ask AI about your codebase instantly — no explaining required",
"version": "0.0.2",
"publisher": "nakummeet",
"license": "MIT",
"engines": {
"vscode": "^1.85.0"
},
"categories": [
"Other",
"Snippets"
],
"icon": "images/icon.ico",
"keywords": [
"ai",
"context",
"chatgpt",
"claude",
"gemini",
"developer tools",
"productivity"
],
"repository": {
"type": "git",
"url": "https://github.com/nakummeet/contextflow"
},
"activationEvents": [
"onStartupFinished"
],
"main": "./out/extension.js",

"contributes": {
"commands": [
{
"command": "contextflow.generateBasic",
"title": "⚡ Ask AI (Quick Context)",
"icon": "$(zap)"
},
{
"command": "contextflow.generateTree",
"title": "🌳 Ask AI (Project Structure)",
"icon": "$(list-tree)"
},
{
"command": "contextflow.generateFull",
"title": "📄 Ask AI (Full Codebase)",
"icon": "$(file-code)"
},
{
"command": "contextflow.copy",
"title": "Copy Context",
"icon": "$(copy)"
},
{
"command": "contextflow.refresh",
"title": "Refresh Context",
"icon": "$(refresh)"
},
{
"command": "contextflow.refreshFilePicker",
"title": "Refresh File List",
"icon": "$(refresh)"
},
{
"command": "contextflow.selectAll",
"title": "Select All Files",
"icon": "$(check-all)"
},
{
"command": "contextflow.deselectAll",
"title": "Deselect All Files",
"icon": "$(close-all)"
},
{
"command": "contextflow.toggleFile",
"title": "Toggle File Selection"
}
],


"viewsContainers": {
  "activitybar": [
    {
      "id": "contextflowExplorer",
      "title": "ContextFlow",
      "icon": "$(comment-discussion)"
    }
  ]
},

"views": {
  "contextflowExplorer": [
    {
      "id": "contextflowSidebar",
      "name": "Actions",
      "type": "webview"
    },
    {
      "id": "contextflowFiles",
      "name": "Files"
    }
  ]
},

"menus": {
  "view/title": [
    {
      "command": "contextflow.refreshFilePicker",
      "when": "view == contextflowFiles",
      "group": "navigation@1"
    },
    {
      "command": "contextflow.selectAll",
      "when": "view == contextflowFiles",
      "group": "navigation@2"
    },
    {
      "command": "contextflow.deselectAll",
      "when": "view == contextflowFiles",
      "group": "navigation@3"
    }
  ]
},

"configuration": {
  "title": "ContextFlow",
  "properties": {
    "contextflow.outputFileName": {
      "type": "string",
      "default": "contextflow.md",
      "description": "Name of the generated context file"
    },
    "contextflow.autoOpenAfterGenerate": {
      "type": "boolean",
      "default": true,
      "description": "Open the file after generation"
    },
    "contextflow.includeGitHistory": {
      "type": "boolean",
      "default": true,
      "description": "Include recent git commits"
    },
    "contextflow.autoOpenAI": {
      "type": "boolean",
      "default": true,
      "description": "Automatically open ChatGPT after generating context"
    }
  }
}


},

"scripts": {
"vscode:prepublish": "npm run compile",
"compile": "tsc -p ./",
"watch": "tsc -watch -p ./"
},

"devDependencies": {
"@types/node": "^20.19.39",
"@types/vscode": "^1.85.0",
"typescript": "^5.3.0"
},

"dependencies": {
"@vscode/vsce": "^3.9.1"
}
}

```

### README.md  _(75 lines)_
```markdown
# ContextFlow — AI Context Builder

> 🚀 Generate AI-ready project context once — reuse it across ChatGPT, Claude, Gemini, Grok, Perplexity, and more.

---

## 🧠 What is ContextFlow?

ContextFlow analyzes your codebase and generates a structured Markdown file that helps AI tools instantly understand your project — without you repeatedly explaining it.

---

## ✨ Features`

### 🔍 Smart Project Analysis
- Detects tech stack automatically
- Builds clean project structure
- Identifies key files and scripts

### 🌳 Multiple Output Modes
- **Basic** — Overview + structure + git history
- **Project Tree** — Visual architecture with file relationships
- **Full Code** — Includes complete file contents

### 📋 AI-Ready Output
- Generates a structured `contextflow.md` file optimized for AI tools
- Clean formatting with headings, tables, and sections

### 📁 File Selection
- Choose specific files to include
- Perfect for sharing only relevant parts

### 🕐 Git Insights
- Includes recent commits
- Helps AI understand development progress

### ⚡ Productivity Features
- One-click generation
- Copy to clipboard
- Auto-refresh on file save

---

## 🚀 Quick Start

1. Open your project in VS Code
2. Open the **ContextFlow panel** (left sidebar)
3. Choose a mode:
   - ⚡ Basic
   - 🌳 Project Tree
   - 📄 Full Code
4. Generate your context file
5. Paste it into any AI tool

---

## 🧩 Example Use Case

Instead of typing the same explanation every time:

```txt
This is my project... it uses Express, MongoDB, JWT auth...
```

ContextFlow generates it all automatically — structured, clean, and AI-ready.

**Made with ❤️ for developers who are tired of re-explaining their stack.**

---

## 👤 Author

Meet Nakum  
Computer Engineering Student  
Frontend & Web Development Enthusiast
```

### tsconfig.json  _(18 lines)_
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "./out",
    "rootDir": "./src",
    "strict": true,
    "types": ["node"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", ".vscode-test"]
}

```

## 🕐 Recent Git Activity

- `76e1a42` | Nakum Meet | 2 weeks ago | change readme and add mit license
- `1bc38f2` | Nakum Meet | 2 weeks ago | add icon on package.json
- `6061e3b` | Nakum Meet | 2 weeks ago | do complet project
- `765834e` | Nakum Meet | 2 weeks ago | add tree logic
- `9fe9dd4` | Nakum Meet | 2 weeks ago | Initial commit: AI Context Manager extension

---
_Generated by AIBridge — 📄 Full Code mode_