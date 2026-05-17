import * as vscode from 'vscode';
import { generateContext } from './commands/generateContext';
import { copyContext } from './commands/copyContext';
import { refreshContext } from './commands/refreshContext';
import { showDiff } from './commands/showDiff';
import { askCopilot } from './commands/askCopilot';
import { detectErrors } from './commands/detecterrors';
import { showChatHistory, initChatHistory } from './commands/chathistory';
import { FilePickerProvider, FileItem } from './providers/filePickerProvider';
import { createStatusBar } from './statusBar';
import { registerFileWatcher, disposeFileWatcher } from './utils/fileWatcher';
import { openAICodeBridgePanel } from './ui/webviewPanel';
import { SidebarPanelProvider } from './ui/SidebarPanelProvider';

export function activate(context: vscode.ExtensionContext): void {
  console.log('AICodeBridge v0.0.4 activated.');

  initChatHistory(context);

  const statusBar = createStatusBar(context);
  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const picker = new FilePickerProvider(rootPath);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('aicodebridge-sidebar', new SidebarPanelProvider(context))
  );

  context.subscriptions.push(
    vscode.window.createTreeView('aicodebridge-files', { treeDataProvider: picker, showCollapseAll: true })
  );

  // Generate modes
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.generateBasic', () => generateContext([], 'basic')));
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.generateTree', () => generateContext([], 'tree')));
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.generateFull', async () => {
    const files = picker.getSelected();
    if (!files.length) {
      vscode.window.showWarningMessage('AICodeBridge: Select files for Full mode.');
      return;
    }
    await generateContext(files, 'full');
  }));

  // Actions
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.copy', copyContext));
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.refresh', refreshContext));
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.showDiff', showDiff));

  // Ask Copilot — replaces sendToAI
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.askCopilot', askCopilot));

  // Error detection & chat history
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.detectErrors', detectErrors));
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.chatHistory', showChatHistory));

  // File picker commands
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.toggleFile', (item: FileItem) => {
    picker.toggle(item);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.selectAll', () => picker.selectAll()));
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.deselectAll', () => picker.deselectAll()));
  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.refreshFilePicker', () => {
    picker.refresh();
    vscode.window.showInformationMessage('AICodeBridge: File list refreshed.');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aicodebrdige.openPanel', () => openAICodeBridgePanel(context)));

  registerFileWatcher(context, statusBar, refreshContext);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => picker.refresh())
  );

  const shown = context.globalState.get<boolean>('aicodebrdige.welcome.v4');
  if (!shown) {
    vscode.window.showInformationMessage(
      '👋 AICodeBridge v0.0.4 — Ask Copilot now works directly inside VS Code!',
      'Try Ask Copilot'
    ).then(a => {
      if (a === 'Try Ask Copilot') vscode.commands.executeCommand('aicodebrdige.askCopilot');
    });
    context.globalState.update('aicodebrdige.welcome.v4', true);
  }
}

export function deactivate(): void {
  disposeFileWatcher();
  console.log('AICodeBridge deactivated.');
}