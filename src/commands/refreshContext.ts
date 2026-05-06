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
    vscode.window.showErrorMessage('AICodeBridge: No folder open. Open a project first.');
    return;
  }

  const rootUri = workspaceFolders[0].uri;
  const rootPath = rootUri.fsPath;

  const config = vscode.workspace.getConfiguration('aicodebrdige');
  const outputFileName = config.get<string>('outputFileName') ?? 'aicodebrdige.md';
  const includeGit = config.get<boolean>('includeGitHistory') ?? true;

  try {
    const scanResult = scanWorkspace(rootPath);

    let techStack = null;
    try {
      techStack = detectTechStack(rootPath);
    } catch (e) {
      console.log('AICodeBridge: Tech stack detection failed:', e);
    }

    let gitCommits: import('../utils/gitHelper').GitCommit[] = [];
    if (includeGit && hasGitRepo(rootPath)) {
      try {
        gitCommits = await getGitHistory(rootPath);
      } catch (e) {
        console.log('AICodeBridge: Git fetch failed:', e);
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

    flashStatusBar('$(check) AICodeBridge refreshed', `${outputFileName} updated`, 3000);
    vscode.window.showInformationMessage(`✅ AICodeBridge: ${outputFileName} refreshed.`);

  } catch (err) {
    console.error('AICodeBridge: Refresh failed:', err);
    flashStatusBar('$(warning) AICodeBridge failed', String(err), 4000);
    vscode.window.showErrorMessage('AICodeBridge: Failed to refresh context. Check logs.');
  }
}