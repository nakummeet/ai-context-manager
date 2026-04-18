import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** Represents a single node in the folder tree */
export interface FolderNode {
  name: string;
  isDirectory: boolean;
  children?: FolderNode[];
  relativePath: string;
}

/** Result of a full workspace scan */
export interface ScanResult {
  tree: FolderNode[];
  allFiles: string[];
  keyFiles: string[];
  totalFileCount: number;
}

const KEY_FILE_PATTERNS = [
  'package.json', 'tsconfig.json', 'tsconfig.base.json',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.env.example', '.env.sample', '.env.template',
  'README.md', 'readme.md',
  'requirements.txt', 'pyproject.toml', 'setup.py',
  'go.mod', 'go.sum',
  'Cargo.toml', 'Cargo.lock',
  '.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml',
  '.prettierrc', '.prettierrc.js', '.prettierrc.json',
  'vite.config.ts', 'vite.config.js',
  'webpack.config.js', 'webpack.config.ts',
  'next.config.js', 'next.config.ts', 'next.config.mjs',
  'nuxt.config.ts', 'nuxt.config.js',
  'astro.config.mjs', 'astro.config.ts',
  'svelte.config.js',
  'jest.config.js', 'jest.config.ts',
  'vitest.config.ts', 'vitest.config.js',
  'playwright.config.ts',
  'tailwind.config.js', 'tailwind.config.ts',
  'prisma/schema.prisma',
  '.gitignore', '.gitattributes',
  'turbo.json', 'nx.json',
  'pnpm-workspace.yaml', 'lerna.json',
  'Makefile', 'makefile',
];

/**
 * Get the list of ignored folders from VS Code configuration.
 */
export function getIgnoredFolders(): string[] {
  const config = vscode.workspace.getConfiguration('aiContextManager');
  return config.get<string[]>('ignoredFolders') ?? [
    'node_modules', '.git', 'dist', 'build', '.next',
    'out', 'coverage', '.cache', '.vscode', '__pycache__',
    '.pytest_cache', 'venv', '.env'
  ];
}

/**
 * Get the max depth from VS Code configuration.
 */
export function getMaxDepth(): number {
  const config = vscode.workspace.getConfiguration('aiContextManager');
  return config.get<number>('maxDepth') ?? 4;
}

/**
 * Recursively scan the workspace folder and build a file tree.
 * @param rootPath - Absolute path of the workspace root
 * @returns ScanResult containing tree, all files, key files, and total count
 */
export function scanWorkspace(rootPath: string): ScanResult {
  const ignoredFolders = getIgnoredFolders();
  const maxDepth = getMaxDepth();
  const allFiles: string[] = [];
  const keyFiles: string[] = [];
  let totalFileCount = 0;

  function buildTree(dirPath: string, depth: number): FolderNode[] {
    if (depth > maxDepth) return [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const nodes: FolderNode[] = [];

    for (const entry of entries) {
      if (ignoredFolders.includes(entry.name)) continue;
      // Skip hidden files/folders (except .env.example etc.)
      if (entry.name.startsWith('.') && !KEY_FILE_PATTERNS.some(k => k === entry.name)) {
        if (!entry.name.startsWith('.env') && entry.name !== '.gitignore') continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        const children = buildTree(fullPath, depth + 1);
        nodes.push({
          name: entry.name,
          isDirectory: true,
          children,
          relativePath
        });
      } else {
        totalFileCount++;
        allFiles.push(fullPath);

        // Check if it's a key file
        if (KEY_FILE_PATTERNS.some(pattern => {
          const rel = relativePath.replace(/\\/g, '/');
          return rel === pattern || rel.endsWith('/' + pattern) || entry.name === pattern;
        })) {
          keyFiles.push(relativePath.replace(/\\/g, '/'));
        }

        nodes.push({
          name: entry.name,
          isDirectory: false,
          relativePath
        });
      }
    }

    return nodes;
  }

  const tree = buildTree(rootPath, 0);

  return { tree, allFiles, keyFiles, totalFileCount };
}

/**
 * Convert the folder tree into a readable ASCII tree string.
 * @param nodes - Array of FolderNode objects
 * @param prefix - Current line prefix (for indentation)
 * @param isLast - Whether this node is the last child
 */
export function renderTree(nodes: FolderNode[], prefix = '', isLast = true): string {
  let result = '';

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLastNode = i === nodes.length - 1;
    const connector = isLastNode ? '└── ' : '├── ';
    const childPrefix = prefix + (isLastNode ? '    ' : '│   ');

    result += `${prefix}${connector}${node.name}${node.isDirectory ? '/' : ''}\n`;

    if (node.isDirectory && node.children && node.children.length > 0) {
      result += renderTree(node.children, childPrefix, isLastNode);
    }
  }

  return result;
}
