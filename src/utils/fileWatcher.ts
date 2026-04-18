import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** Tracks the debounce timer for auto-refresh */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Reference to the status bar item for update messages */
let statusBarRef: vscode.StatusBarItem | null = null;

/**
 * Register the file save watcher that auto-refreshes project.ai.md.
 * Only fires if:
 *   - aiContextManager.autoRefreshOnSave is true
 *   - project.ai.md already exists
 *   - The saved file is NOT project.ai.md itself (prevents infinite loop)
 *
 * @param context - Extension context for subscription management
 * @param statusBar - Status bar item to show update notifications
 * @param onRefresh - Callback to invoke when refresh should happen
 * @returns The disposable subscription
 */
export function registerFileWatcher(
  context: vscode.ExtensionContext,
  statusBar: vscode.StatusBarItem,
  onRefresh: () => Promise<void>
): vscode.Disposable {
  statusBarRef = statusBar;

  const disposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    const config = vscode.workspace.getConfiguration('aiContextManager');
    const autoRefresh = config.get<boolean>('autoRefreshOnSave') ?? false;

    if (!autoRefresh) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const outputFileName = config.get<string>('outputFileName') ?? 'project.ai.md';
    const outputFilePath = path.join(rootPath, outputFileName);

    // Don't react to saves of the output file itself
    if (doc.uri.fsPath === outputFilePath) return;

    // Only auto-refresh if project.ai.md already exists
    if (!fs.existsSync(outputFilePath)) return;

    // Debounce: wait 2 seconds after last save
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      try {
        await onRefresh();
        showUpdateMessage(statusBar);
      } catch {
        // Silent failure for auto-refresh
      }
    }, 2000);
  });

  context.subscriptions.push(disposable);
  return disposable;
}

/**
 * Show a temporary status bar message indicating context was updated.
 * @param statusBar - The status bar item to update
 */
function showUpdateMessage(statusBar: vscode.StatusBarItem): void {
  const originalText = statusBar.text;
  const originalTooltip = statusBar.tooltip;

  statusBar.text = '$(sync~spin) AI Context updating...';
  statusBar.tooltip = 'Regenerating project.ai.md...';

  setTimeout(() => {
    statusBar.text = '$(check) AI Context updated';
    statusBar.tooltip = 'project.ai.md was regenerated';

    setTimeout(() => {
      statusBar.text = originalText;
      statusBar.tooltip = originalTooltip instanceof vscode.MarkdownString
        ? originalTooltip
        : originalTooltip ?? 'Click to copy AI project context to clipboard';
    }, 3000);
  }, 1500);
}

/**
 * Dispose the debounce timer if active.
 */
export function disposeFileWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
