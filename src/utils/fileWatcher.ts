import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Error detection (inline — no button needed) ─────────────────────────────

interface DetectedError {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

function getVSCodeErrors(root: string): DetectedError[] {
  const errors: DetectedError[] = [];
  for (const [uri, diags] of vscode.languages.getDiagnostics()) {
    if (!uri.fsPath.startsWith(root)) continue;
    for (const d of diags) {
      if (
        d.severity !== vscode.DiagnosticSeverity.Error &&
        d.severity !== vscode.DiagnosticSeverity.Warning
      ) continue;
      errors.push({
        file: path.relative(root, uri.fsPath).replace(/\\/g, '/'),
        line: d.range.start.line + 1,
        message: d.message,
        severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning',
      });
      if (errors.length >= 20) return errors;
    }
  }
  return errors;
}

function buildErrorSection(errors: DetectedError[]): string {
  const lines: string[] = ['\n\n---\n\n## 🐛 Errors\n'];
  lines.push(`> Auto-scanned: ${new Date().toLocaleString()}\n`);

  if (!errors.length) {
    lines.push('✅ No errors found!\n');
  } else {
    lines.push(`**${errors.length} issue(s) found:**\n`);
    lines.push('| File | Line | Type | Message |');
    lines.push('|------|------|------|---------|');
    for (const e of errors) {
      lines.push(
        `| \`${e.file}\` | ${e.line || '-'} | ${e.severity === 'error' ? '❌' : '⚠️'} | ${e.message} |`
      );
    }
    lines.push('\n> Paste this file into ChatGPT/Claude to fix errors.\n');
  }

  return lines.join('\n');
}

function appendErrorsToFile(outPath: string, root: string): void {
  if (!fs.existsSync(outPath)) return;

  const errors = getVSCodeErrors(root);
  const section = buildErrorSection(errors);

  let existing = fs.readFileSync(outPath, 'utf-8');
  // Remove any previous error section before appending fresh one
  existing = existing.replace(/\n\n---\n\n## 🐛 Errors[\s\S]*$/, '');
  fs.writeFileSync(outPath, existing + section, 'utf-8');
}

// ─── Status bar helpers ───────────────────────────────────────────────────────

function showUpdateMessage(statusBar: vscode.StatusBarItem, fileName: string): void {
  const originalText = statusBar.text;
  const originalTooltip = statusBar.tooltip;

  statusBar.text = '$(sync~spin) AICodeBridge updating...';
  statusBar.tooltip = `Regenerating ${fileName}...`;

  setTimeout(() => {
    statusBar.text = '$(check) AICodeBridge updated';
    statusBar.tooltip = `${fileName} was regenerated`;

    setTimeout(() => {
      statusBar.text = originalText;
      statusBar.tooltip =
        originalTooltip instanceof vscode.MarkdownString
          ? originalTooltip
          : originalTooltip ?? 'Open AICodeBridge panel';
    }, 3000);
  }, 1500);
}

// ─── Main watcher ─────────────────────────────────────────────────────────────

export function registerFileWatcher(
  context: vscode.ExtensionContext,
  statusBar: vscode.StatusBarItem,
  onRefresh: () => Promise<void>
): vscode.Disposable {

  const disposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    const config = vscode.workspace.getConfiguration('aicodebrdige');
    const autoRefresh = config.get<boolean>('autoRefreshOnSave') ?? false;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const outputFileName = config.get<string>('outputFileName') ?? 'aicodebrdige.md';
    const outputFilePath = path.join(rootPath, outputFileName);

    // Never watch the output file itself
    if (doc.uri.fsPath === outputFilePath) return;
    if (!fs.existsSync(outputFilePath)) return;

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      debounceTimer = null;

      try {
        // Refresh context if enabled
        if (autoRefresh) {
          await onRefresh();
          showUpdateMessage(statusBar, outputFileName);
        }

        // Always append fresh error section after any file save
        appendErrorsToFile(outputFilePath, rootPath);

      } catch {
        // Silent failure — auto features should never interrupt the developer
      }
    }, 2000);
  });

  context.subscriptions.push(disposable);
  return disposable;
}

export function disposeFileWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}