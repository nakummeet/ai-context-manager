import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DetectedError {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

function detectProjectType(root: string): string {
  if (fs.existsSync(path.join(root, 'pubspec.yaml'))) return 'flutter';
  if (fs.existsSync(path.join(root, 'requirements.txt')) || fs.existsSync(path.join(root, 'pyproject.toml'))) return 'python';
  if (fs.existsSync(path.join(root, 'pom.xml')) || fs.existsSync(path.join(root, 'build.gradle'))) return 'java';
  if (fs.existsSync(path.join(root, 'tsconfig.json'))) return 'typescript';
  if (fs.existsSync(path.join(root, 'package.json'))) return 'javascript';
  return 'unknown';
}

// Use VS Code's built-in diagnostics — works for ALL languages instantly
function getVSCodeErrors(root: string): DetectedError[] {
  const errors: DetectedError[] = [];
  for (const [uri, diags] of vscode.languages.getDiagnostics()) {
    if (!uri.fsPath.startsWith(root)) continue;
    for (const d of diags) {
      if (d.severity !== vscode.DiagnosticSeverity.Error && d.severity !== vscode.DiagnosticSeverity.Warning) continue;
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

// Fallback CLI for TypeScript
async function runTsc(root: string): Promise<DetectedError[]> {
  try {
    await execAsync('npx tsc --noEmit', { cwd: root, timeout: 15000 });
    return [];
  } catch (e: any) {
    return (e.stdout || e.stderr || '').split('\n')
      .filter(Boolean)
      .slice(0, 20)
      .map((l: string) => {
        const m = l.match(/(.+)\((\d+),\d+\):\s+(error|warning)\s+\w+:\s+(.+)/);
        return m
          ? { file: m[1].trim(), line: Number(m[2]), message: m[4].trim(), severity: m[3] as 'error' | 'warning' }
          : { file: 'unknown', line: 0, message: l.trim(), severity: 'error' as const };
      })
      .filter((e: DetectedError) => e.message.length > 0);
  }
}

export async function detectErrors(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    vscode.window.showErrorMessage('AICodeBridge: Open a project first.');
    return;
  }

  const root = folders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('aicodebrdige');
  const fileName = config.get<string>('outputFileName') ?? 'aicodebrdige.md';
  const outPath = path.join(root, fileName);

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'AICodeBridge — Detecting errors...', cancellable: false },
    async (progress) => {
      progress.report({ message: 'Scanning...', increment: 30 });

      const projectType = detectProjectType(root);
      let errors = getVSCodeErrors(root);

      // Fallback to CLI if VS Code diagnostics empty
      if (!errors.length && projectType === 'typescript') {
        progress.report({ message: 'Running tsc...', increment: 40 });
        errors = await runTsc(root);
      }

      progress.report({ message: 'Writing results...', increment: 20 });

      const lines: string[] = ['\n\n---\n\n## 🐛 Errors\n'];
      lines.push(`> Scanned: ${new Date().toLocaleString()} | Type: ${projectType}\n`);

      if (!errors.length) {
        lines.push('✅ No errors found!\n');
      } else {
        lines.push(`**${errors.length} issue(s) found:**\n`);
        lines.push('| File | Line | Type | Message |');
        lines.push('|------|------|------|---------|');
        for (const e of errors) {
          lines.push(`| \`${e.file}\` | ${e.line || '-'} | ${e.severity === 'error' ? '❌' : '⚠️'} | ${e.message} |`);
        }
        lines.push('\n> Paste this file into ChatGPT/Claude to fix errors.\n');
      }

      // Append to context file
      if (fs.existsSync(outPath)) {
        let existing = fs.readFileSync(outPath, 'utf-8');
        existing = existing.replace(/\n\n---\n\n## 🐛 Errors[\s\S]*$/, '');
        fs.writeFileSync(outPath, existing + lines.join('\n'), 'utf-8');
      } else {
        fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
      }

      progress.report({ message: 'Done!', increment: 10 });

      const action = await vscode.window.showInformationMessage(
        errors.length ? `🐛 Found ${errors.length} error(s) — added to context file!` : '✅ No errors found!',
        errors.length ? 'Send to AI' : 'OK'
      );

      if (action === 'Send to AI') {
        vscode.commands.executeCommand('aicodebrdige.askCopilot');
      }
    }
  );
}