import * as vscode from 'vscode';
import { generateContext } from './commands/generateContext';
import { copyContext } from './commands/copyContext';
import { refreshContext } from './commands/refreshContext';
import { showDiff } from './commands/showDiff';
import { FilePickerProvider, FileItem } from './providers/filePickerProvider';
import { createStatusBar } from './statusBar';
import { registerFileWatcher, disposeFileWatcher } from './utils/fileWatcher';

export function activate(context: vscode.ExtensionContext): void {
  console.log('AIBridge v2.0 activated.');

  const statusBar = createStatusBar(context);

  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const picker = new FilePickerProvider(rootPath);

  context.subscriptions.push(
    vscode.window.createTreeView('aibridgeFiles', {
      treeDataProvider: picker,
      showCollapseAll: true,
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.generate', async () => {
      await generateContext([]);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.copy', async () => {
      await copyContext();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.refresh', async () => {
      await refreshContext();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.showDiff', async () => {
      await showDiff();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aibridge.generateWithSelected', async () => {
      const files = picker.getSelected();
      if (files.length === 0) {
        const answer = await vscode.window.showInformationMessage(
          'AIBridge: No files selected. Generate without file contents?',
          'Generate Anyway',
          'Cancel'
        );
        if (answer !== 'Generate Anyway') return;
      }
      await generateContext(files);
    })
  );

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

  registerFileWatcher(context, statusBar, async () => {
    await refreshContext();
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      picker.refresh();
    })
  );

  const shown = context.globalState.get<boolean>('aibridge.welcome');
  if (!shown) {
    vscode.window
      .showInformationMessage(
        '👋 AIBridge is ready! Press Ctrl+Shift+Alt+G to generate your first context.',
        'Generate Now'
      )
      .then(answer => {
        if (answer === 'Generate Now') {
          vscode.commands.executeCommand('aibridge.generate');
        }
      });
    context.globalState.update('aibridge.welcome', true);
  }
}

export function deactivate(): void {
  disposeFileWatcher();
  console.log('AIBridge deactivated.');
}