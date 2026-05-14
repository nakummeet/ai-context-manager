import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { detectTechStack, getProjectName } from '../utils/techDetector';
import { getGitHistory } from '../utils/gitHelper';
import { buildMarkdown, GenerateMode } from '../utils/markdownBuilder';
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

// Strip existing error section from markdown string
function stripErrorSection(md: string): string {
  return md.replace(/\n\n---\n\n## 🐛 Errors[\s\S]*$/, '');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function generateContext(
  selectedFiles: string[] = [],
  mode: GenerateMode = 'basic'
): Promise<void> {

  try {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!root) {
      vscode.window.showErrorMessage('AICodeBridge: Please open a folder first.');
      return;
    }

    const cfg = vscode.workspace.getConfiguration('aicodebrdige');
    const outFileName = cfg.get<string>('outputFileName') ?? 'aicodebrdige.md';
    const outFile = path.join(root, outFileName);
    const autoOpen = cfg.get<boolean>('autoOpenAfterGenerate') ?? true;

    if (mode === 'basic' || mode === 'tree') {
      selectedFiles = [];
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `AICodeBridge — Generating ${mode}...`,
        cancellable: false,
      },
      async (progress) => {

        progress.report({ message: 'Scanning workspace...', increment: 20 });
        const scan = scanWorkspace(root);

        if (scan.totalFileCount > 10000) {
          const ans = await vscode.window.showWarningMessage(
            `AICodeBridge: ${scan.totalFileCount.toLocaleString()} files found. Continue?`,
            'Continue',
            'Cancel'
          );
          if (ans !== 'Continue') return;
        }

        progress.report({ message: 'Detecting tech stack...', increment: 20 });
        const techStack = detectTechStack(root);

        progress.report({ message: 'Reading git history...', increment: 20 });
        const includeGit = cfg.get<boolean>('includeGitHistory') ?? true;
        const gitCommits = includeGit ? await getGitHistory(root) : [];

        progress.report({ message: `Building ${mode} output...`, increment: 20 });

        // Build fresh markdown (no error section)
        let md = buildMarkdown({
          projectName: getProjectName(root),
          rootPath: root,
          techStack,
          tree: scan.tree,
          keyFiles: scan.keyFiles,
          gitCommits,
          selectedFiles,
          treeFlat: scan.allFiles,
          mode,
        });

        // Strip any leftover error section from buildMarkdown output (safety)
        md = stripErrorSection(md);

        // Always append fresh error section at the bottom
        progress.report({ message: 'Scanning errors...', increment: 10 });
        md = md + buildErrorSection(root);

        await fs.promises.writeFile(outFile, md, 'utf-8');

        progress.report({ message: 'Done!', increment: 10 });

        if (autoOpen) {
          const doc = await vscode.workspace.openTextDocument(outFile);
          await vscode.window.showTextDocument(doc);
        }

        const modeNames: Record<GenerateMode, string> = {
          basic: 'Basic',
          tree: 'Project Tree',
          full: 'Full Code',
        };

        flashStatusBar(
          '$(check) AICodeBridge generated',
          `${outFileName} ready (${modeNames[mode]} mode)`,
          4000
        );

        vscode.window.showInformationMessage(
          `✅ AICodeBridge: Generated in ${modeNames[mode]} mode` +
          (mode === 'full' && selectedFiles.length > 0
            ? ` — ${selectedFiles.length} file(s)`
            : '')
        );
      }
    );

  } catch (err: any) {
    console.error('AICodeBridge Error:', err);
    vscode.window.showErrorMessage(
      `❌ AICodeBridge failed: ${err?.message || 'Unknown error'}`
    );
  }
}