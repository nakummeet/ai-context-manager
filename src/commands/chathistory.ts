import * as vscode from 'vscode';

export interface ChatEntry {
  tool: string;
  fileName: string;
  timestamp: string;
  preview: string;
}

let _context: vscode.ExtensionContext | null = null;
const HISTORY_KEY = 'aicodebrdige.chatHistory';
const MAX_HISTORY = 20;

export function initChatHistory(context: vscode.ExtensionContext): void {
  _context = context;
}

export function addChatHistory(entry: ChatEntry): void {
  if (!_context) return;
  const history = getChatHistory();
  history.unshift(entry);
  _context.globalState.update(HISTORY_KEY, history.slice(0, MAX_HISTORY));
}

export function getChatHistory(): ChatEntry[] {
  if (!_context) return [];
  return _context.globalState.get<ChatEntry[]>(HISTORY_KEY) ?? [];
}

export async function showChatHistory(): Promise<void> {
  const history = getChatHistory();

  if (!history.length) {
    vscode.window.showInformationMessage('AICodeBridge: No history yet. Send context to an AI tool first!');
    return;
  }

  const items: vscode.QuickPickItem[] = [
    ...history.map(h => ({
      label: `$(history) ${h.tool.toUpperCase()} — ${new Date(h.timestamp).toLocaleString()}`,
      description: h.preview.slice(0, 60) + '...',
      detail: `File: ${h.fileName}`,
    })),
    { label: '$(trash) Clear History', description: 'Remove all sessions' },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: 'AICodeBridge — Chat History',
    placeHolder: 'Recent AI sessions',
  });

  if (!picked) return;

  if (picked.label.includes('Clear History')) {
    _context?.globalState.update(HISTORY_KEY, []);
    vscode.window.showInformationMessage('AICodeBridge: History cleared.');
    return;
  }

  const action = await vscode.window.showQuickPick(['Send to AI again', 'Cancel'], {
    title: 'What would you like to do?',
  });
  if (action === 'Send to AI again') {
    vscode.commands.executeCommand('aicodebrdige.sendToAI');
  }
}