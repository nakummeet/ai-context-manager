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