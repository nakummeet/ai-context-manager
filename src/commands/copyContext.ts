import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { flashStatusBar } from '../statusBar';


export async function copyContext(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    vscode.window.showErrorMessage(
      'AI Context Manager: Please open a folder first.'
    );
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('aiContextManager');
  const outputFileName = config.get<string>('outputFileName') ?? 'project.ai.md';
  const outputFilePath = path.join(rootPath, outputFileName);

  // ── Check if file exists ──────────────────────────────────────────────────
  if (!fs.existsSync(outputFilePath)) {
    const answer = await vscode.window.showWarningMessage(
      `AI Context Manager: ${outputFileName} does not exist yet.`,
      'Generate Now',
      'Cancel'
    );

    if (answer === 'Generate Now') {
      await vscode.commands.executeCommand('aiContextManager.generate');
      // After generation, re-check
      if (!fs.existsSync(outputFilePath)) return;
    } else {
      return;
    }
  }

  // ── Read content ──────────────────────────────────────────────────────────
  let content: string;
  try {
    content = fs.readFileSync(outputFilePath, 'utf-8');
  } catch (err) {
    vscode.window.showErrorMessage(
      `AI Context Manager: Could not read ${outputFileName} — ${String(err)}`
    );
    return;
  }

  // ── Format for clipboard ──────────────────────────────────────────────────
  const clipboardContent = `Here is my project context:\n\n${content}\n\n---\n\nMy question: `;

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  try {
    await vscode.env.clipboard.writeText(clipboardContent);
  } catch (err) {
    vscode.window.showErrorMessage(
      `AI Context Manager: Failed to copy to clipboard — ${String(err)}`
    );
    return;
  }

  flashStatusBar(
    '$(copy) Context copied!',
    'Project context copied to clipboard — paste into any AI tool',
    4000
  );

  vscode.window.showInformationMessage(
    '📋 AI Context Manager: Context copied to clipboard! Paste into ChatGPT, Claude, Gemini, or any AI tool.'
  );
}
