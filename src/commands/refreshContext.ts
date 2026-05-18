import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
      ) {
        continue;
      }

      errors.push({
        file: path.relative(root, uri.fsPath).replace(/\\/g, '/'),
        line: d.range.start.line + 1,
        message: d.message,
        severity:
          d.severity === vscode.DiagnosticSeverity.Error
            ? 'error'
            : 'warning',
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
        `| \`${e.file}\` | ${e.line || '-'} | ${e.severity === 'error' ? '❌' : '⚠️'
        } | ${e.message} |`
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
    vscode.window.showErrorMessage(
      'AICodeBridge: No folder open. Open a project first.'
    );
    return;
  }

  const rootUri = workspaceFolders[0].uri;
  const rootPath = rootUri.fsPath;

  const config = vscode.workspace.getConfiguration('aicodebrdige');

  const outputFileName =
    config.get<string>('outputFileName') ?? 'aicodebrdige.md';

  const outputFilePath = path.join(rootPath, outputFileName);

  try {
    if (!fs.existsSync(outputFilePath)) {
      vscode.window.showWarningMessage(
        'AICodeBridge: Generate context first.'
      );
      return;
    }

    // Read existing generated file
    let markdown = fs.readFileSync(outputFilePath, 'utf-8');

    // Remove old error section only
    markdown = stripErrorSection(markdown);

    // Append fresh errors
    markdown += buildErrorSection(rootPath);

    await fs.promises.writeFile(
      outputFilePath,
      markdown,
      'utf-8'
    );

    flashStatusBar(
      '$(check) AICodeBridge refreshed',
      `${outputFileName} updated`,
      3000
    );

    vscode.window.showInformationMessage(
      `✅ AICodeBridge: ${outputFileName} refreshed.`
    );

  } catch (err) {
    console.error('AICodeBridge: Refresh failed:', err);

    flashStatusBar(
      '$(warning) AICodeBridge failed',
      String(err),
      4000
    );

    vscode.window.showErrorMessage(
      'AICodeBridge: Failed to refresh context. Check logs.'
    );
  }
}