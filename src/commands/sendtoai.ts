import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addChatHistory } from './chathistory';

interface AITool {
  id: string;
  label: string;
  description: string;
  url: (ctx: string) => string;
  // Gemini does not support ?q= or any URL param — clipboard only
  clipboardOnly: boolean;
}

const AI_TOOLS: AITool[] = [
  {
    id: 'chatgpt',
    label: '$(globe) ChatGPT',
    description: 'Open in ChatGPT',
    url: (ctx: string) => `https://chatgpt.com/?q=${encodeURIComponent(ctx)}`,
    clipboardOnly: false,
  },
  {
    id: 'claude',
    label: '$(globe) Claude',
    description: 'Open in Claude',
    url: (ctx: string) => `https://claude.ai/new?q=${encodeURIComponent(ctx)}`,
    clipboardOnly: false,
  },
  {
    id: 'gemini',
    label: '$(globe) Gemini',
    description: 'Open in Gemini — paste with Ctrl+V',
    url: () => `https://gemini.google.com/app`,
    clipboardOnly: true,
  },
];

// Shared helper — reads context file, copies full content to clipboard,
// opens browser. For tools that support ?q= (ChatGPT, Claude) the trimmed
// context is also injected in the URL. For Gemini (clipboard-only) the URL
// is opened clean and the user pastes manually with Ctrl+V / Cmd+V.
async function openInBrowser(toolId: string, filePath: string, fileName: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tool = AI_TOOLS.find(t => t.id === toolId);
  if (!tool) return;

  // Full context always goes to clipboard
  const clipboardText = `Here is my project context:\n\n${content}\n\n---\n\nMy question: `;
  await vscode.env.clipboard.writeText(clipboardText);

  if (tool.clipboardOnly) {
    // Gemini: open clean URL, context is on clipboard, show paste reminder
    await vscode.env.openExternal(vscode.Uri.parse(tool.url('')));
    addChatHistory({
      tool: toolId,
      fileName,
      timestamp: new Date().toISOString(),
      preview: content.slice(0, 100),
    });
    vscode.window.showInformationMessage(
      '📋 Gemini opened — context copied to clipboard. Press Ctrl+V (or Cmd+V) to paste.'
    );
  } else {
    // ChatGPT / Claude: inject trimmed context in URL for auto-paste
    const trimmed = content.length > 2000
      ? content.slice(0, 2000) + '\n\n[...see clipboard for full context]'
      : content;
    const urlContext = `Here is my project context:\n\n${trimmed}\n\nMy question: `;
    await vscode.env.openExternal(vscode.Uri.parse(tool.url(urlContext)));
    addChatHistory({
      tool: toolId,
      fileName,
      timestamp: new Date().toISOString(),
      preview: content.slice(0, 100),
    });
    vscode.window.showInformationMessage(
      `✅ Opened in ${tool.id} — full context also copied to clipboard!`
    );
  }
}

// Shared helper — ensures context file exists, generating it if needed
async function ensureContextFile(filePath: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    const answer = await vscode.window.showWarningMessage(
      'AICodeBridge: No context file found. Generate now?',
      'Generate',
      'Cancel'
    );
    if (answer !== 'Generate') return false;
    await vscode.commands.executeCommand('aicodebrdige.generateBasic');
    if (!fs.existsSync(filePath)) return false;
  }
  return true;
}

// Called from command palette — shows QuickPick to choose AI tool
export async function sendToAI(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    vscode.window.showErrorMessage('AICodeBridge: Open a project first.');
    return;
  }

  const root = folders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('aicodebrdige');
  const fileName = config.get<string>('outputFileName') ?? 'aicodebrdige.md';
  const filePath = path.join(root, fileName);

  const ready = await ensureContextFile(filePath);
  if (!ready) return;

  const picked = await vscode.window.showQuickPick(
    AI_TOOLS.map(t => ({ label: t.label, description: t.description, id: t.id })),
    { title: 'AICodeBridge — Send to AI', placeHolder: 'Choose AI tool' }
  );
  if (!picked) return;

  await openInBrowser(picked.id, filePath, fileName);
}

// Called directly from sidebar buttons with a specific tool id
export async function sendToAIWith(toolId: string): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    vscode.window.showErrorMessage('AICodeBridge: Open a project first.');
    return;
  }

  const root = folders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('aicodebrdige');
  const fileName = config.get<string>('outputFileName') ?? 'aicodebrdige.md';
  const filePath = path.join(root, fileName);

  const ready = await ensureContextFile(filePath);
  if (!ready) return;

  await openInBrowser(toolId, filePath, fileName);
}