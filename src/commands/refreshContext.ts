import * as vscode from 'vscode';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { detectTechStack, getProjectName } from '../utils/techDetector';
import { getGitHistory, hasGitRepo } from '../utils/gitHelper';
import { buildMarkdown } from '../utils/markdownBuilder';
import { flashStatusBar } from '../statusBar';

export async function refreshContext(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('ContextFlow: No folder open. Open a project first.');
    return;
  }

  const rootUri = workspaceFolders[0].uri;
  const rootPath = rootUri.fsPath;

  const config = vscode.workspace.getConfiguration('contextflow');
  const outputFileName = config.get<string>('outputFileName') ?? 'contextflow.md';
  const includeGit = config.get<boolean>('includeGitHistory') ?? true;

  try {
    const scanResult = scanWorkspace(rootPath);

    let techStack = null;
    try {
      techStack = detectTechStack(rootPath);
    } catch (e) {
      console.log('ContextFlow: Tech stack detection failed:', e);
    }

    let gitCommits: import('../utils/gitHelper').GitCommit[] = [];
    if (includeGit && hasGitRepo(rootPath)) {
      try {
        gitCommits = await getGitHistory(rootPath);
      } catch (e) {
        console.log('ContextFlow: Git fetch failed:', e);
      }
    }

    const markdown = buildMarkdown({
      projectName: getProjectName(rootPath),
      rootPath,
      techStack,
      tree: scanResult.tree,
      keyFiles: scanResult.keyFiles,
      gitCommits,
      selectedFiles: [],
      mode: 'basic',
    });

    const fileUri = vscode.Uri.joinPath(rootUri, outputFileName);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(markdown, 'utf-8'));

    flashStatusBar('$(check) ContextFlow refreshed', `${outputFileName} updated`, 3000);
    vscode.window.showInformationMessage(`✅ ContextFlow: ${outputFileName} refreshed.`);

  } catch (err) {
    console.error('ContextFlow: Refresh failed:', err);
    flashStatusBar('$(warning) ContextFlow failed', String(err), 4000);
    vscode.window.showErrorMessage('ContextFlow: Failed to refresh context. Check logs.');
  }
}