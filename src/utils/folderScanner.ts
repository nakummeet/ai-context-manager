import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface FolderNode {
  name: string;
  isDirectory: boolean;
  children?: FolderNode[];
  relativePath: string;
}

export interface ScanResult {
  tree: FolderNode[];
  allFiles: string[]; // ✅ restored
  keyFiles: string[];
  totalFileCount: number;
}

const KEY_FILES = new Set([
  'package.json', 'tsconfig.json', 'Dockerfile',
  'docker-compose.yml', 'README.md', '.gitignore'
]);

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.mp4', '.mp3', '.zip', '.exe'
]);

export function getIgnoredFolders(): string[] {
  const config = vscode.workspace.getConfiguration('aiContextManager'); // ✅ fixed
  return config.get<string[]>('ignoredFolders') ?? [
    'node_modules', '.git', 'dist', 'build', '.next', 'out'
  ];
}

export function getMaxDepth(): number {
  const config = vscode.workspace.getConfiguration('aiContextManager'); // ✅ fixed
  return config.get<number>('maxDepth') ?? 4;
}

export function scanWorkspace(rootPath: string): ScanResult {
  const ignoredFolders = getIgnoredFolders();
  const maxDepth = getMaxDepth();

  const allFiles: string[] = [];
  const keyFiles: string[] = [];
  let totalFileCount = 0;

  function buildTree(dir: string, depth: number): FolderNode[] {
    if (depth > maxDepth) {
      return [{
        name: '...',
        isDirectory: true,
        relativePath: ''
      }];
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const nodes: FolderNode[] = [];

    for (const entry of entries) {
      if (ignoredFolders.includes(entry.name)) continue;

      const full = path.join(dir, entry.name);
      const rel = path.relative(rootPath, full).replace(/\\/g, '/');

      if (entry.name.startsWith('.') && !KEY_FILES.has(entry.name)) continue;

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          isDirectory: true,
          children: buildTree(full, depth + 1),
          relativePath: rel
        });

      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SKIP_EXTENSIONS.has(ext)) continue;

        totalFileCount++;
        allFiles.push(full);

        if (KEY_FILES.has(entry.name)) {
          keyFiles.push(rel);
        }

        nodes.push({
          name: entry.name,
          isDirectory: false,
          relativePath: rel
        });
      }
    }

    return nodes;
  }

  return {
    tree: buildTree(rootPath, 0),
    allFiles,
    keyFiles,
    totalFileCount
  };
}

export function renderTree(nodes: FolderNode[], prefix = ''): string {
  let result = '';

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;

    const connector = isLast ? '└── ' : '├── ';
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');

    result += `${prefix}${connector}${node.name}${node.isDirectory ? '/' : ''}\n`;

    if (node.isDirectory && node.children) {
      result += renderTree(node.children, nextPrefix);
    }
  }

  return result;
}