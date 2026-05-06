import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { flashStatusBar } from '../statusBar';

export async function copyContext(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    vscode.window.showErrorMessage('AICodeBridge: Please open a folder first.');
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('aicodebrdige');
  const outputFileName = config.get<string>('outputFileName') ?? 'aicodebrdige.md';
  const outputFilePath = path.join(rootPath, outputFileName);

  if (!fs.existsSync(outputFilePath)) {
    const answer = await vscode.window.showWarningMessage(
      `AICodeBridge: ${outputFileName} does not exist yet.`,
      'Generate Now',
      'Cancel'
    );

    if (answer === 'Generate Now') {
      await vscode.commands.executeCommand('aicodebrdige.generateBasic');
      if (!fs.existsSync(outputFilePath)) return;
    } else {
      return;
    }
  }

  let content: string;
  try {
    content = fs.readFileSync(outputFilePath, 'utf-8');
  } catch (err) {
    vscode.window.showErrorMessage(
      `AICodeBridge: Could not read ${outputFileName} — ${String(err)}`
    );
    return;
  }

  const clipboardContent = `Here is my project context:\n\n${content}\n\n---\n\nMy question: `;

  try {
    await vscode.env.clipboard.writeText(clipboardContent);
  } catch (err) {
    vscode.window.showErrorMessage(
      `AICodeBridge: Failed to copy to clipboard — ${String(err)}`
    );
    return;
  }

  flashStatusBar(
    '$(copy) Context copied!',
    'Project context copied to clipboard — paste into any AI tool',
    4000
  );

  vscode.window.showInformationMessage(
    '📋 AICodeBridge: Context copied! Paste into ChatGPT, Claude, Gemini, or any AI tool.'
  );
}