import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function askCopilot(context: vscode.ExtensionContext): Promise<void> {
  // 1. Check workspace
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    vscode.window.showErrorMessage('AICodeBridge: Open a project first.');
    return;
  }

  const root = folders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('aicodebrdige');
  const fileName = config.get<string>('outputFileName') ?? 'aicodebrdige.md';
  const filePath = path.join(root, fileName);

  // 2. Ensure context file exists
  if (!fs.existsSync(filePath)) {
    const answer = await vscode.window.showWarningMessage(
      `AICodeBridge: No context file found (${fileName}). Generate one first.`,
      'Generate Basic',
      'Cancel'
    );
    if (answer === 'Generate Basic') {
      await vscode.commands.executeCommand('aicodebrdige.generateBasic');
      if (!fs.existsSync(filePath)) { return; }
    } else {
      return;
    }
  }

  // 3. Check Copilot Chat
  const copilotChatAvailable = vscode.extensions.getExtension('GitHub.copilot-chat');
  if (!copilotChatAvailable) {
    const action = await vscode.window.showWarningMessage(
      'GitHub Copilot Chat is not installed.',
      'Install Copilot Chat'
    );
    if (action === 'Install Copilot Chat') {
      vscode.commands.executeCommand('workbench.extensions.search', 'GitHub.copilot-chat');
    }
    return;
  }

  try {
    const fileUri = vscode.Uri.file(filePath);

    // Try official chat attach API first (VS Code 1.90+)
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        attachFiles: [fileUri],
      });
      return;
    } catch { /* try next */ }

    // Try with query using #file mention
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: `#file:${fileName} `,
        isPartialQuery: true,
      });
      return;
    } catch { /* try next */ }

    // Final fallback — open file in editor + open chat
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    await new Promise(resolve => setTimeout(resolve, 500));
    await vscode.commands.executeCommand('workbench.action.chat.open');

  } catch (err) {
    vscode.window.showErrorMessage(
      `AICodeBridge: Failed to open Copilot Chat — ${String(err)}`
    );
  }
}