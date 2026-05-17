import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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

  // 3. Read context file
  let contextContent: string;
  try {
    contextContent = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    vscode.window.showErrorMessage(`AICodeBridge: Could not read ${fileName} — ${String(err)}`);
    return;
  }

  // 4. Build message — ends with "My question: " so user just types after
  const fullMessage = `Here is my project context:\n\n${contextContent}\n\n---\n\nMy question: `;

  // 5. Copy to clipboard
  await vscode.env.clipboard.writeText(fullMessage);

  const copilotChatAvailable = vscode.extensions.getExtension('GitHub.copilot-chat');

  if (copilotChatAvailable) {
    try {
      // Open Copilot Chat panel
      await vscode.commands.executeCommand('workbench.action.chat.open');

      // Wait for panel to fully open and input to be focused
      await new Promise(resolve => setTimeout(resolve, 600));

      // Trigger paste — this pastes the context into the chat input automatically
      await vscode.commands.executeCommand('editor.action.clipboardPasteAction');

      // Small delay then try the workbench paste as fallback
      await new Promise(resolve => setTimeout(resolve, 200));
      await vscode.commands.executeCommand('workbench.action.terminal.paste');

    } catch {
      // Silent — clipboard already has content as backup
    }
  } else {
    const action = await vscode.window.showWarningMessage(
      'GitHub Copilot Chat is not installed.',
      'Install Copilot Chat'
    );
    if (action === 'Install Copilot Chat') {
      vscode.commands.executeCommand('workbench.extensions.search', 'GitHub.copilot-chat');
    }
  }
}