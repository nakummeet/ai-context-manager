import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { scanWorkspace } from '../utils/folderScanner';
import { detectTechStack, getProjectName } from '../utils/techDetector';
import { getGitHistory, hasGitRepo } from '../utils/gitHelper';
import { buildMarkdown } from '../utils/markdownBuilder';
import { flashStatusBar } from '../statusBar';

// ─── Error section helpers ────────────────────────────────────────────────────

interface DetectedError {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

function getVSCodeErrors(root: string): DetectedError[] {
  const errors: DetectedError[] = [];
  for (const [uri, diags] of vscode.languages.getDiagnostics()) {
    if (!uri.fsPath.startsWith(root)) continue;
    for (const d of diags) {
      if (
        d.severity !== vscode.DiagnosticSeverity.Error &&
        d.severity !== vscode.DiagnosticSeverity.Warning
      ) continue;
      errors.push({
        file: path.relative(root, uri.fsPath).replace(/\\/g, '/'),
        line: d.range.start.line + 1,
        message: d.message,
        severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning',
      });
      if (errors.length >= 20) return errors;
    }
  }
  return errors;
}

function buildErrorSection(root: string): string {
  const errors = getVSCodeErrors(root);
  const lines: string[] = ['\n\n---\n\n## 🐛 Errors\n'];
  lines.push(`> Auto-scanned: ${new Date().toLocaleString()}\n`);

  if (!errors.length) {
    lines.push('✅ No errors found!\n');
  } else {
    lines.push(`**${errors.length} issue(s) found:**\n`);
    lines.push('| File | Line | Type | Message |');
    lines.push('|------|------|------|---------|');
    for (const e of errors) {
      lines.push(
        `| \`${e.file}\` | ${e.line || '-'} | ${e.severity === 'error' ? '❌' : '⚠️'} | ${e.message} |`
      );
    }
    lines.push('\n> Paste this file into ChatGPT/Claude to fix errors.\n');
  }

  return lines.join('\n');
}

function stripErrorSection(md: string): string {
  return md.replace(/\n\n---\n\n## 🐛 Errors[\s\S]*$/, '');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

    // FIX 2 side-effect: detectTechStack now always returns TechStack, never null
    const techStack = detectTechStack(rootPath);

    let gitCommits: import('../utils/gitHelper').GitCommit[] = [];
    if (includeGit && hasGitRepo(rootPath)) {
      try {
        gitCommits = await getGitHistory(rootPath);
      } catch (e) {
        console.log('AICodeBridge: Git fetch failed:', e);
      }
    }

    // Build fresh markdown
    // FIX 4: pass treeFlat so key-file detection works correctly in basic mode
    let markdown = buildMarkdown({
      projectName: getProjectName(rootPath),
      rootPath,
      techStack,
      tree: scanResult.tree,
      keyFiles: scanResult.keyFiles,
      gitCommits,
      selectedFiles: [],
      treeFlat: scanResult.allFiles,
      mode: 'basic',
    });

    // Strip any leftover error section (safety)
    markdown = stripErrorSection(markdown);

    // Always append fresh error section at the bottom
    markdown = markdown + buildErrorSection(rootPath);

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