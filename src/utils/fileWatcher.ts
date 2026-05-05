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