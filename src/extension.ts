import * as vscode from 'vscode';
import { generateContext } from './commands/generateContext';
import { copyContext } from './commands/copyContext';
import { refreshContext } from './commands/refreshContext';
import { showDiff } from './commands/showDiff';
import { FilePickerProvider, FileItem } from './providers/filePickerProvider';
import { createStatusBar } from './statusBar';
import { registerFileWatcher, disposeFileWatcher } from './utils/fileWatcher';
import { openAICodeBridgePanel } from './ui/webviewPanel';
import { SidebarPanelProvider } from './ui/SidebarPanelProvider';

export function activate(context: vscode.ExtensionContext): void {
  console.log('AICodeBridge v2.0 activated.');

  const statusBar = createStatusBar(context);

  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const picker = new FilePickerProvider(rootPath);

  const provider = new SidebarPanelProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'aicodebridge-sidebar',
      provider
    )
  );

  // 🌳 Tree View
  context.subscriptions.push(
    vscode.window.createTreeView('aicodebridge-files', {
      treeDataProvider: picker,
      showCollapseAll: true,
    })
  );

  // ⚡ BASIC
  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.generateBasic', async () => {
      await generateContext([], 'basic');
    })
  );

  // 🌳 TREE
  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.generateTree', async () => {
      await generateContext([], 'tree');
    })
  );

  // 📄 FULL (requires selection)
  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.generateFull', async () => {
      const files = picker.getSelected();

      if (files.length === 0) {
        vscode.window.showWarningMessage(
          'AICodeBridge: Select files for Full mode.'
        );
        return;
      }

      await generateContext(files, 'full');
    })
  );

  // 📋 Copy
  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.copy', async () => {
      await copyContext();
    })
  );

  // 🔄 Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.refresh', async () => {
      await refreshContext();
    })
  );

  // 🔍 Diff
  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.showDiff', async () => {
      await showDiff();
    })
  );

  // 📁 File selection
  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.toggleFile', (item: FileItem) => {
      picker.toggle(item);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.selectAll', () => {
      picker.selectAll();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.deselectAll', () => {
      picker.deselectAll();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.refreshFilePicker', () => {
      picker.refresh();
      vscode.window.showInformationMessage('AICodeBridge: File list refreshed.');
    })
  );

  // 🚀 Webview Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('aicodebrdige.openPanel', () => {
      openAICodeBridgePanel(context);
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

  // 👋 Welcome message
  const shown = context.globalState.get<boolean>('aicodebrdige.welcome');
  if (!shown) {
    vscode.window
      .showInformationMessage(
        '👋 AICodeBridge is ready! Use sidebar buttons or open panel.',
        'Open Panel'
      )
      .then(answer => {
        if (answer === 'Open Panel') {
          vscode.commands.executeCommand('aicodebrdige.openPanel');
        }
      });

    context.globalState.update('aicodebrdige.welcome', true);
  }
}

export function deactivate(): void {
  disposeFileWatcher();
  console.log('AICodeBridge deactivated.');
}