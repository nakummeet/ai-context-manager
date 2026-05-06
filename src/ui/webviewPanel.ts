import * as vscode from 'vscode';

export function openAICodeBridgePanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'aicodebridge-panel',
    'AICodeBridge',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getHtml();

  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.command) {
      case 'basic':
        vscode.commands.executeCommand('aicodebrdige.generateBasic');
        break;
      case 'tree':
        vscode.commands.executeCommand('aicodebrdige.generateTree');
        break;
      case 'full':
        vscode.commands.executeCommand('aicodebrdige.generateFull');
        break;
    }
  });
}

function getHtml(): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        font-family: sans-serif;
        padding: 20px;
        background: #1e1e1e;
        color: white;
      }
      button {
        width: 100%;
        padding: 20px;
        margin: 10px 0;
        font-size: 18px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
      }
      .basic { background: #007acc; }
      .tree { background: #388a34; }
      .full { background: #a31515; }
    </style>
  </head>
  <body>

    <h2>AICodeBridge</h2>

    <button class="basic" onclick="send('basic')">⚡ Generate Basic</button>
    <button class="tree" onclick="send('tree')">🌳 Generate Tree</button>
    <button class="full" onclick="send('full')">📄 Generate Full</button>

    <script>
      const vscode = acquireVsCodeApi();
      function send(cmd) {
        vscode.postMessage({ command: cmd });
      }
    </script>

  </body>
  </html>
  `;
}