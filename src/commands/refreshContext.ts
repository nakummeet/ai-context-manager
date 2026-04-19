import * as vscode from 'vscode';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { detectTechStack, getProjectName } from '../utils/techDetector';
import { getGitHistory, hasGitRepo } from '../utils/gitHelper';
import { buildMarkdown } from '../utils/markdownBuilder';
import { flashStatusBar } from '../statusBar';

export async function refreshContext(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  // ❌ No workspace → stop immediately
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("❌ No folder open. Open a project first.");
    return;
  }

  const rootUri = workspaceFolders[0].uri;
  const rootPath = rootUri.fsPath;

  const config = vscode.workspace.getConfiguration('aiContextManager');
  const outputFileName =
    config.get<string>('outputFileName') ?? 'project.ai.md';

  const includeGit =
    config.get<boolean>('includeGitHistory') ?? true;

  try {
    console.log("🔹 Refresh started");
    console.log("Root:", rootPath);

    // ---------------- SCAN ----------------
    const scanResult = scanWorkspace(rootPath);

    // ---------------- TECH STACK ----------------
    let techStack = null;
    try {
      techStack = detectTechStack(rootPath);
    } catch (e) {
      console.log("Tech stack detection failed:", e);
    }

    // ---------------- GIT ----------------
    let gitCommits: import('../utils/gitHelper').GitCommit[] = [];

    if (includeGit && hasGitRepo(rootPath)) {
      try {
        gitCommits = await getGitHistory(rootPath);
      } catch (e) {
        console.log("Git fetch failed:", e);
      }
    }

    const projectName = getProjectName(rootPath);

    // ---------------- BUILD MARKDOWN ----------------
    const markdown = buildMarkdown({
      projectName,
      rootPath,
      techStack,
      tree: scanResult.tree,
      keyFiles: scanResult.keyFiles,
      gitCommits,
      selectedFiles: [],
      mode: "basic" // ⚠️ IMPORTANT (your builder expects mode)
    });

    // ---------------- WRITE FILE (SAFE WAY) ----------------
    const fileUri = vscode.Uri.joinPath(rootUri, outputFileName);

    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from(markdown, 'utf-8')
    );

    console.log("✅ File written:", fileUri.fsPath);

    flashStatusBar(
      '$(check) AI Context refreshed',
      `${outputFileName} created`,
      3000
    );

    // Optional popup (for debugging)
    vscode.window.showInformationMessage(
      `✅ Context file created: ${outputFileName}`
    );

  } catch (err) {
    console.error("❌ Refresh failed:", err);

    flashStatusBar(
      '$(warning) AI Context failed',
      String(err),
      4000
    );

    vscode.window.showErrorMessage(
      "❌ Failed to generate context. Check logs."
    );
  }
}