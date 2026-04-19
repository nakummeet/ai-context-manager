import * as vscode from 'vscode';

/** The persistent status bar item instance */
let statusBarItem: vscode.StatusBarItem | null = null;

/**
 * Create and show the AI Context status bar button.
 * Displayed on the right side of the VS Code status bar.
 * Clicking it runs the Copy Context command.
 *
 * @param context - Extension context for subscription tracking
 * @returns The created StatusBarItem
 */
export function createStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  statusBarItem.text = '$(comment-discussion) AIBridge';
  statusBarItem.tooltip = 'Open AIBridge panel';
  statusBarItem.command = 'aibridge.openPanel';
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);

  return statusBarItem;
}

/**
 * Get the existing status bar item (if created).
 */
export function getStatusBar(): vscode.StatusBarItem | null {
  return statusBarItem;
}

/**
 * Temporarily update the status bar text and tooltip, then restore.
 * Useful for showing transient notifications.
 *
 * @param text - Text to show (supports $(icon) syntax)
 * @param tooltip - Tooltip message
 * @param durationMs - How long to show the message (default 3000ms)
 */
export function flashStatusBar(
  text: string,
  tooltip: string,
  durationMs = 3000
): void {
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
