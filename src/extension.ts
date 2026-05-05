import * as vscode from 'vscode';
import { generateContext } from './commands/generateContext';
import { copyContext } from './commands/copyContext';
import { refreshContext } from './commands/refreshContext';
import { showDiff } from './commands/showDiff';
import { FilePickerProvider, FileItem } from './providers/filePickerProvider';
import { createStatusBar } from './statusBar';
import { registerFileWatcher, disposeFileWatcher } from './utils/fileWatcher';
import { opencontextflowPanel } from './ui/webviewPanel';
import { SidebarPanelProvider } from './ui/SidebarPanelProvider';

export function activate(context: vscode.ExtensionContext): void {
  console.log('contextflow v2.0 activated.');

  const statusBar = createStatusBar(context);

  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const picker = new FilePickerProvider(rootPath);

  const provider = new SidebarPanelProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'contextflowSidebar',
      provider
    )
  );

  // 🌳 Tree View
  context.subscriptions.push(
    vscode.window.createTreeView('contextflowFiles', {
      treeDataProvider: picker,
      showCollapseAll: true,
    })
  );

  // ⚡ BASIC
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.generateBasic', async () => {
      await generateContext([], 'basic');
    })
  );

  // 🌳 TREE
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.generateTree', async () => {
      await generateContext([], 'tree');
    })
  );

  // 📄 FULL (requires selection)
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.generateFull', async () => {
      const files = picker.getSelected();

      if (files.length === 0) {
        vscode.window.showWarningMessage(
          'contextflow: Select files for Full mode.'
        );
        return;
      }

      await generateContext(files, 'full');
    })
  );

  // 📋 Copy
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.copy', async () => {
      await copyContext();
    })
  );

  // 🔄 Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.refresh', async () => {
      await refreshContext();
    })
  );

  // 🔍 Diff
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.showDiff', async () => {
      await showDiff();
    })
  );

  // 📁 File selection
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.toggleFile', (item: FileItem) => {
      picker.toggle(item);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.selectAll', () => {
      picker.selectAll();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.deselectAll', () => {
      picker.deselectAll();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.refreshFilePicker', () => {
      picker.refresh();
      vscode.window.showInformationMessage('contextflow: File list refreshed.');
    })
  );

  // 🚀 Webview Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('contextflow.openPanel', () => {
      opencontextflowPanel(context);
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
  const shown = context.globalState.get<boolean>('contextflow.welcome');
  if (!shown) {
    vscode.window
      .showInformationMessage(
        '👋 contextflow is ready! Use sidebar buttons or open panel.',
        'Open Panel'
      )
      .then(answer => {
        if (answer === 'Open Panel') {
          vscode.commands.executeCommand('contextflow.openPanel');
        }
      });

    context.globalState.update('contextflow.welcome', true);
  }
}

export function deactivate(): void {
  disposeFileWatcher();
  console.log('contextflow deactivated.');
}