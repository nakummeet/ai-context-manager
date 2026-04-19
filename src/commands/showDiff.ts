import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { getProjectName } from '../utils/techDetector';

let channel: vscode.OutputChannel | null = null;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('AI Context Diff');
  }
  return channel;
}

export async function showDiff(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders;
  if (!ws?.length) {
    vscode.window.showErrorMessage('Open a project first');
    return;
  }

  const root = ws[0].uri.fsPath;

  const config = vscode.workspace.getConfiguration('aiContextManager');
  const fileName = config.get<string>('outputFileName') ?? 'project.ai.md';
  const filePath = path.join(root, fileName);

  if (!fs.existsSync(filePath)) {
    vscode.window.showWarningMessage('Generate context first');
    return;
  }

  const channel = getChannel();
  channel.clear();
  channel.show(true);

  const oldContent = fs.readFileSync(filePath, 'utf-8');

  const oldFiles = new Set(
    oldContent
      .split('\n')
      .map(l => l.match(/[├└]── (.+)$/))
      .filter(Boolean)
      .map(m => m![1].trim())
      .filter(f => !f.endsWith('/'))
  );

  const scan = scanWorkspace(root);

  const currentFiles = new Set(
    scan.allFiles.map(f =>
      path.relative(root, f).replace(/\\/g, '/')
    )
  );

  const newFiles: string[] = [];
  const deletedFiles: string[] = [];

  for (const f of currentFiles) {
    if (!oldFiles.has(path.basename(f))) {
      newFiles.push(f);
    }
  }

  for (const f of oldFiles) {
    const exists = Array.from(currentFiles).some(cf => path.basename(cf) === f);
    if (!exists) {
      deletedFiles.push(f);
    }
  }

  channel.appendLine('==== AI CONTEXT DIFF ====');
  channel.appendLine(`Project: ${getProjectName(root)}\n`);

  if (newFiles.length) {
    channel.appendLine('NEW FILES:');
    newFiles.slice(0, 50).forEach(f => channel.appendLine(`+ ${f}`));
    channel.appendLine('');
  }

  if (deletedFiles.length) {
    channel.appendLine('DELETED FILES:');
    deletedFiles.slice(0, 50).forEach(f => channel.appendLine(`- ${f}`));
    channel.appendLine('');
  }

  if (!newFiles.length && !deletedFiles.length) {
    channel.appendLine('No changes detected');
  }
}