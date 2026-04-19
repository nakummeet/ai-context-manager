import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanWorkspace } from '../utils/folderScanner';
import { detectTechStack, getProjectName } from '../utils/techDetector';
import { getGitHistory } from '../utils/gitHelper';
import { buildMarkdown, GenerateMode } from '../utils/markdownBuilder';
import { flashStatusBar } from '../statusBar';

export async function generateContext(
  selectedFiles: string[] = [],
  mode: GenerateMode = 'basic'
): Promise<void> {

  try {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!root) {
      vscode.window.showErrorMessage('AIBridge: Please open a folder first.');
      return;
    }

    const cfg = vscode.workspace.getConfiguration('aiprompt');
    const outFileName = cfg.get<string>('outputFileName') ?? 'aiprompt.md';
    const outFile = path.join(root, outFileName);
    const autoOpen = cfg.get<boolean>('autoOpenAfterGenerate') ?? true;

    // 🧠 Mode behavior
    if (mode === 'basic' || mode === 'tree') {
      selectedFiles = []; // ignore selection
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `AIBridge — Generating ${mode}...`,
        cancellable: false,
      },
      async (progress) => {

        // 🔍 Scan workspace
        progress.report({ message: 'Scanning workspace...', increment: 20 });
        const scan = scanWorkspace(root);

        if (scan.totalFileCount > 10000) {
          const ans = await vscode.window.showWarningMessage(
            `AIBridge: ${scan.totalFileCount.toLocaleString()} files found. Continue?`,
            'Continue',
            'Cancel'
          );
          if (ans !== 'Continue') return;
        }

        // 🛠 Detect tech stack
        progress.report({ message: 'Detecting tech stack...', increment: 20 });
        const techStack = detectTechStack(root);

        // 🕐 Git history
        progress.report({ message: 'Reading git history...', increment: 20 });
        const includeGit = cfg.get<boolean>('includeGitHistory') ?? true;
        const gitCommits = includeGit ? await getGitHistory(root) : [];

        // 🧱 Build markdown
        progress.report({ message: `Building ${mode} output...`, increment: 30 });

        const md = buildMarkdown({
          projectName: getProjectName(root),
          rootPath: root,
          techStack,
          tree: scan.tree,
          keyFiles: scan.keyFiles,
          gitCommits,
          selectedFiles,

          // 🔥 IMPORTANT FIX (for advanced tree)
          treeFlat: scan.allFiles,

          mode,
        });

        // 💾 Write file
        await fs.promises.writeFile(outFile, md, 'utf-8');

        progress.report({ message: 'Done!', increment: 10 });

        // 📄 Auto open
        if (autoOpen) {
          const doc = await vscode.workspace.openTextDocument(outFile);
          await vscode.window.showTextDocument(doc);
        }

        const modeNames: Record<GenerateMode, string> = {
          basic: 'Basic',
          tree: 'Project Tree',
          full: 'Full Code',
        };

        // 📊 Status bar
        flashStatusBar(
          '$(check) AIBridge generated',
          `${outFileName} ready (${modeNames[mode]} mode)`,
          4000
        );

        // 🔔 Notification
        vscode.window.showInformationMessage(
          `✅ AIBridge: Generated in ${modeNames[mode]} mode` +
          (mode === 'full' && selectedFiles.length > 0
            ? ` — ${selectedFiles.length} file(s)`
            : '')
        );
      }
    );

  } catch (err: any) {
    console.error('AIBridge Error:', err);

    vscode.window.showErrorMessage(
      `❌ AIBridge failed: ${err?.message || 'Unknown error'}`
    );
  }
}