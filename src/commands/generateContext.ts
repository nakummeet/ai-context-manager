import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { detectTechStack, getProjectName } from '../utils/techDetector';
import { getGitHistory } from '../utils/gitHelper';
import { buildMarkdown, GenerateMode } from '../utils/markdownBuilder';
import { flashStatusBar } from '../statusBar';

export async function generateContext(selectedFiles: string[] = []): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showErrorMessage('AIBridge: Please open a folder first.');
    return;
  }

  const cfg = vscode.workspace.getConfiguration('aibridge');
  const outFileName = cfg.get<string>('outputFileName') ?? 'aibridge.md';
  const outFile = path.join(root, outFileName);
  const autoOpen = cfg.get<boolean>('autoOpenAfterGenerate') ?? true;

  // ── Ask user to pick mode ─────────────────────────────────────────────────
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: '⚡ Basic',
        description: 'Structure + stack + last commits + file list (no code)',
        mode: 'basic' as GenerateMode,
      },
      {
        label: '🌳 Project tree',
        description: 'Visual tree showing each file and what it connects to',
        mode: 'tree' as GenerateMode,
      },
      {
        label: '📄 Full code',
        description: 'Everything + complete code of all selected files',
        mode: 'full' as GenerateMode,
      },
    ],
    {
      title: 'AIBridge — Choose output mode',
      placeHolder: selectedFiles.length > 0
        ? `${selectedFiles.length} file(s) selected`
        : 'No files selected — only structure and git will be included',
    }
  );

  if (!choice) return;
  const mode = choice.mode;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'AIBridge',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Scanning workspace...', increment: 20 });
      const scan = scanWorkspace(root);

      if (scan.totalFileCount > 10000) {
        const ans = await vscode.window.showWarningMessage(
          `AIBridge: ${scan.totalFileCount.toLocaleString()} files found. Continue?`,
          'Continue', 'Cancel'
        );
        if (ans !== 'Continue') return;
      }

      progress.report({ message: 'Detecting tech stack...', increment: 20 });
      const techStack = detectTechStack(root);

      progress.report({ message: 'Reading git history...', increment: 20 });
      const includeGit = cfg.get<boolean>('includeGitHistory') ?? true;
      const gitCommits = includeGit ? getGitHistory(root) : [];

      progress.report({ message: `Building ${mode} output...`, increment: 30 });

      const md = buildMarkdown({
        projectName: getProjectName(root),
        rootPath: root,
        techStack,
        tree: scan.tree,
        keyFiles: scan.keyFiles,
        gitCommits,
        selectedFiles,
        mode,
      });

      fs.writeFileSync(outFile, md, 'utf-8');
      progress.report({ message: 'Done!', increment: 10 });

      if (autoOpen) {
        const doc = await vscode.workspace.openTextDocument(outFile);
        await vscode.window.showTextDocument(doc);
      }

      const modeNames: Record<GenerateMode, string> = {
        basic: 'Basic',
        tree:  'Project Tree',
        full:  'Full Code',
      };

      flashStatusBar(
        '$(check) AIBridge generated',
        `${outFileName} ready (${modeNames[mode]} mode)`,
        4000
      );

      vscode.window.showInformationMessage(
        `✅ AIBridge: Generated in ${modeNames[mode]} mode` +
        (selectedFiles.length > 0 ? ` — ${selectedFiles.length} file(s)` : '')
      );
    }
  );
}