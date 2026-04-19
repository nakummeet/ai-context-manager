import * as vscode from 'vscode';
import { generateContext } from './commands/generateContext';
import { copyContext } from './commands/copyContext';
import { refreshContext } from './commands/refreshContext';
import { showDiff } from './commands/showDiff';
import { FilePickerProvider, FileItem } from './providers/filePickerProvider';
import { createStatusBar } from './statusBar';
import { registerFileWatcher, disposeFileWatcher } from './utils/fileWatcher';
import { openAIBridgePanel } from './ui/webviewPanel';
import { SidebarPanelProvider } from './ui/SidebarPanelProvider';

export function activate(context: vscode.ExtensionContext): void {
  console.log('AIBridge v2.0 activated.');

  const statusBar = createStatusBar(context);

  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const picker = new FilePickerProvider(rootPath);

  const provider = new SidebarPanelProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'aibridgeSidebar',
      provider
    )
  );

  // 🌳 Tree View
  context.subscriptions.push(
    vscode.window.createTreeView('aibridgeFiles', {
      treeDataProvider: picker,
      showCollapseAll: true,
    })
  );

  // ⚡ BASIC
  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.generateBasic', async () => {
      await generateContext([], 'basic');
    })
  );

  // 🌳 TREE
  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.generateTree', async () => {
      await generateContext([], 'tree');
    })
  );

  // 📄 FULL (requires selection)
  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.generateFull', async () => {
      const files = picker.getSelected();

      if (files.length === 0) {
        vscode.window.showWarningMessage(
          'AIBridge: Select files for Full mode.'
        );
        return;
      }

      await generateContext(files, 'full');
    })
  );

  // 📋 Copy
  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.copy', async () => {
      await copyContext();
    })
  );

  // 🔄 Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.refresh', async () => {
      await refreshContext();
    })
  );

  // 🔍 Diff
  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.showDiff', async () => {
      await showDiff();
    })
  );

  // 📁 File selection
  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.toggleFile', (item: FileItem) => {
      picker.toggle(item);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.selectAll', () => {
      picker.selectAll();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.deselectAll', () => {
      picker.deselectAll();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.refreshFilePicker', () => {
      picker.refresh();
      vscode.window.showInformationMessage('AIBridge: File list refreshed.');
    })
  );

  // 🚀 Webview Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.openPanel', () => {
      openAIBridgePanel(context);
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
  const shown = context.globalState.get<boolean>('aibridge.welcome');
  if (!shown) {
    vscode.window
      .showInformationMessage(
        '👋 AIBridge is ready! Use sidebar buttons or open panel.',
        'Open Panel'
      )
      .then(answer => {
        if (answer === 'Open Panel') {
          vscode.commands.executeCommand('aibridge.openPanel');
        }
      });

    context.globalState.update('aibridge.welcome', true);
  }
}

export function deactivate(): void {
  disposeFileWatcher();
  console.log('AIBridge deactivated.');
}