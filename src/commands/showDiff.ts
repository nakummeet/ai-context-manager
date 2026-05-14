import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { getProjectName } from '../utils/techDetector';

let channel: vscode.OutputChannel | null = null;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('AICodeBridge Diff');
  }
  return channel;
}

export async function showDiff(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders;
  if (!ws?.length) {
    vscode.window.showErrorMessage('AICodeBridge: Open a project first.');
    return;
  }

  const root = ws[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('aicodebrdige');
  const fileName = config.get<string>('outputFileName') ?? 'aicodebrdige.md';
  const filePath = path.join(root, fileName);

  if (!fs.existsSync(filePath)) {
    vscode.window.showWarningMessage('AICodeBridge: Generate context first.');
    return;
  }

  const ch = getChannel();
  ch.clear();
  ch.show(true);

  const oldContent = fs.readFileSync(filePath, 'utf-8');

  // FIX 3: extract full relative paths (e.g. "src/index.ts") from the tree,
  // not just basenames — avoids false matches when two folders have same-named files.
  const oldFiles = new Set<string>();
  for (const line of oldContent.split('\n')) {
    // Match tree connector lines: ├── or └── with optional leading │/space chars
    const m = line.match(/[├└]── (.+?)\/?\s*$/);
    if (!m) continue;
    const name = m[1].trim();
    if (name === '...') continue;           // depth-truncation placeholder
    if (name.endsWith('/')) continue;       // directory — skip
    oldFiles.add(name);
  }

  const scan = scanWorkspace(root);

  // Build a map of basename → full relative paths so we can do accurate matching
  const currentByBasename = new Map<string, string[]>();
  for (const absPath of scan.allFiles) {
    const rel = path.relative(root, absPath).replace(/\\/g, '/');
    const base = path.basename(rel);
    if (!currentByBasename.has(base)) currentByBasename.set(base, []);
    currentByBasename.get(base)!.push(rel);
  }

  const currentFiles = new Set(
    scan.allFiles.map(f => path.relative(root, f).replace(/\\/g, '/'))
  );

  const newFiles: string[] = [];
  const deletedFiles: string[] = [];

  // Files in current workspace not recorded in old snapshot
  for (const rel of currentFiles) {
    const base = path.basename(rel);
    if (!oldFiles.has(base)) newFiles.push(rel);
  }

  // Files in old snapshot no longer present in current workspace
  for (const base of oldFiles) {
    const matches = currentByBasename.get(base);
    if (!matches || matches.length === 0) deletedFiles.push(base);
  }

  ch.appendLine('==== AICODEBRDIGE DIFF ====');
  ch.appendLine(`Project: ${getProjectName(root)}\n`);

  if (newFiles.length) {
    ch.appendLine('NEW FILES:');
    newFiles.slice(0, 50).forEach(f => ch.appendLine(`+ ${f}`));
    ch.appendLine('');
  }

  if (deletedFiles.length) {
    ch.appendLine('DELETED FILES:');
    deletedFiles.slice(0, 50).forEach(f => ch.appendLine(`- ${f}`));
    ch.appendLine('');
  }

  if (!newFiles.length && !deletedFiles.length) {
    ch.appendLine('No changes detected.');
  }
}