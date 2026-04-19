import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TechStack, getNpmScripts, getEnvKeys } from './techDetector';
import { FolderNode, renderTree } from './folderScanner';
import { GitCommit } from './gitHelper';

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.avif',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm', '.mkv', '.ogg',
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.db', '.sqlite', '.sqlite3',
  '.glb', '.gltf', '.fbx', '.obj',
  '.psd', '.ai', '.sketch', '.fig',
  '.class', '.jar', '.pyc', '.o', '.a',
  '.bin', '.dat', '.iso', '.svg',
]);

const LOCK_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Cargo.lock', 'poetry.lock', 'composer.lock', 'Gemfile.lock',
]);

const IGNORE_IN_TREE = new Set([
  'aibridge.md', 'project.ai.md', '.gitignore', '.env',
  'vercel.json', 'netlify.toml', '.eslintrc.json', '.prettierrc',
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024;

export type GenerateMode = 'basic' | 'tree' | 'full';

export function isBinaryOrLockFile(filePath: string): boolean {
  return (
    BINARY_EXT.has(path.extname(filePath).toLowerCase()) ||
    LOCK_FILES.has(path.basename(filePath))
  );
}

function isFileTooLarge(filePath: string): boolean {
  try { return fs.statSync(filePath).size > MAX_FILE_SIZE_BYTES; }
  catch { return true; }
}

function hasBinaryContent(buffer: Buffer): boolean {
  const sample = buffer.slice(0, 512);
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b === 0) return true;
    if (b < 8 || (b > 13 && b < 32 && b !== 27)) bad++;
  }
  return bad / sample.length > 0.1;
}

function getLang(filePath: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'tsx',
    '.js': 'javascript', '.jsx': 'jsx', '.mjs': 'javascript',
    '.json': 'json', '.md': 'markdown',
    '.html': 'html', '.htm': 'html',
    '.css': 'css', '.scss': 'scss', '.sass': 'sass', '.less': 'less',
    '.py': 'python', '.go': 'go', '.rs': 'rust',
    '.java': 'java', '.rb': 'ruby', '.php': 'php',
    '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
    '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
    '.sql': 'sql', '.graphql': 'graphql', '.prisma': 'prisma', '.env': 'bash',
  };
  const base = path.basename(filePath).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  return map[path.extname(filePath).toLowerCase()] ?? '';
}

function readSafe(fp: string): { content: string; error: string | null } {
  if (isBinaryOrLockFile(fp)) return { content: '', error: 'binary or lock file' };
  if (isFileTooLarge(fp)) return { content: '', error: 'file too large (over 50KB)' };
  let buf: Buffer;
  try { buf = fs.readFileSync(fp); }
  catch { return { content: '', error: 'could not read file' }; }
  if (hasBinaryContent(buf)) return { content: '', error: 'binary content detected' };
  return { content: buf.toString('utf-8'), error: null };
}

function getFileMeta(fp: string): { lines: number; sizeKb: string } {
  try {
    const content = fs.readFileSync(fp, 'utf-8');
    return {
      lines: content.split('\n').length,
      sizeKb: (fs.statSync(fp).size / 1024).toFixed(1),
    };
  } catch { return { lines: 0, sizeKb: '?' }; }
}

// ── Detect imports/dependencies from file content ─────────────────────────
function detectDeps(fp: string): string[] {
  const { content, error } = readSafe(fp);
  if (error) return [];

  const deps: string[] = [];
  const ext = path.extname(fp).toLowerCase();
  const lines = content.split('\n').slice(0, 60);

  for (const line of lines) {
    const htmlMatch = line.match(/(?:href|src)=["']([^"'#?]+)["']/);
    if (htmlMatch) {
      const val = htmlMatch[1].trim();
      if (val.startsWith('http')) {
        const cdn = val.match(/\/([a-zA-Z0-9-]+)[@/]/);
        if (cdn) deps.push(`${cdn[1]} (CDN)`);
      } else if (val && !val.startsWith('data:')) {
        deps.push(val.replace(/^\.\.?\//, ''));
      }
      continue;
    }

    if (['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(ext)) {
      const imp = line.match(/(?:from|require)\s*\(?\s*['"]([^'"]+)['"]/);
      if (imp) {
        const val = imp[1];
        if (val.startsWith('.')) deps.push(val.replace(/^\.\.?\//, ''));
        else deps.push(`${val} (pkg)`);
      }
    }

    if (['.css', '.scss', '.sass'].includes(ext)) {
      const imp = line.match(/@import\s+['"]([^'"]+)['"]/);
      if (imp) deps.push(imp[1].replace(/^\.\.?\//, ''));
    }
  }

  return [...new Set(deps)].slice(0, 8);
}

// ── Detect API endpoints from route files ─────────────────────────────────
interface ApiEndpoint {
  method: string;
  path: string;
  handler: string;
  file: string;
}

function extractEndpoints(fp: string, rootPath: string): ApiEndpoint[] {
  const { content, error } = readSafe(fp);
  if (error) return [];

  const endpoints: ApiEndpoint[] = [];
  const rel = path.relative(rootPath, fp).replace(/\\/g, '/');
  const lines = content.split('\n');

  // Detect base path from filename
  const fileName = path.basename(fp, path.extname(fp));
  const basePath = fileName
    .replace('Routes', '')
    .replace('routes', '')
    .replace('Router', '')
    .toLowerCase();

  for (const line of lines) {
    const match = line.match(
      /router\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/i
    );
    if (match) {
      const method = match[1].toUpperCase();
      const routePath = match[2];

      // Try to extract handler name
      const handlerMatch = line.match(/,\s*(?:\w+\.)?(\w+)\s*[,)]/);
      const handler = handlerMatch ? handlerMatch[1] : '';

      endpoints.push({
        method,
        path: `/${basePath}${routePath === '/' ? '' : routePath}`,
        handler,
        file: rel,
      });
    }
  }

  return endpoints;
}

// ── Detect important files and their roles ────────────────────────────────
interface ImportantFile {
  path: string;
  role: string;
  why: string;
  lines: number;
}

function analyzeImportantFiles(
  selectedFiles: string[],
  rootPath: string
): ImportantFile[] {
  const important: ImportantFile[] = [];

  const roleMap: Array<{
    pattern: RegExp;
    role: string;
    why: (name: string) => string;
  }> = [
      {
        pattern: /controller/i,
        role: 'Controller',
        why: (n) => `Handles business logic for ${n.replace(/controller/i, '').replace(/\./, '')} operations`,
      },
      {
        pattern: /middleware/i,
        role: 'Middleware',
        why: (n) => `Intercepts requests — ${n.includes('auth') ? 'verifies JWT tokens and protects routes' : n.includes('error') ? 'handles errors globally' : n.includes('role') ? 'enforces role-based access control' : 'validates or transforms requests'}`,
      },
      {
        pattern: /model/i,
        role: 'Model',
        why: (n) => `Defines ${n.replace(/\.(js|ts)$/, '')} database schema and shape`,
      },
      {
        pattern: /route/i,
        role: 'Router',
        why: (n) => `Maps HTTP endpoints to ${n.replace(/routes?\.(js|ts)$/, '').replace(/\./, '')} controller functions`,
      },
      {
        pattern: /server\.(js|ts)$/i,
        role: 'Entry Point',
        why: () => 'App entry — initializes Express, loads middleware, connects DB, starts server',
      },
      {
        pattern: /index\.(js|ts)$/i,
        role: 'App Root',
        why: () => 'Registers all routes and global middleware onto the Express app',
      },
      {
        pattern: /db\.(js|ts)$/i,
        role: 'Database',
        why: () => 'Manages database connection — called once at startup',
      },
      {
        pattern: /auth/i,
        role: 'Auth',
        why: (n) => `Core authentication — ${n.includes('controller') ? 'handles login/register/logout' : n.includes('middleware') ? 'protects private routes with JWT' : 'auth utilities'}`,
      },
      {
        pattern: /token/i,
        role: 'Utility',
        why: () => 'Generates and signs JWT tokens for authenticated sessions',
      },
      {
        pattern: /response|apiResponse/i,
        role: 'Utility',
        why: () => 'Standardizes all API responses — used by every controller',
      },
    ];

  for (const fp of selectedFiles) {
    const base = path.basename(fp);
    if (IGNORE_IN_TREE.has(base) || LOCK_FILES.has(base)) continue;
    if (isBinaryOrLockFile(fp)) continue;

    const meta = getFileMeta(fp);
    const rel = path.relative(rootPath, fp).replace(/\\/g, '/');

    for (const rule of roleMap) {
      if (rule.pattern.test(base)) {
        important.push({
          path: rel,
          role: rule.role,
          why: rule.why(base),
          lines: meta.lines,
        });
        break;
      }
    }
  }

  // Sort by role priority
  const rolePriority: Record<string, number> = {
    'Entry Point': 1,
    'App Root': 2,
    'Database': 3,
    'Auth': 4,
    'Controller': 5,
    'Router': 6,
    'Middleware': 7,
    'Model': 8,
    'Utility': 9,
  };

  return important
    .sort((a, b) => (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99))
    .slice(0, 10);
}

// ── Detect business flow from project structure ───────────────────────────
function detectBusinessFlow(
  selectedFiles: string[],
  techStack: TechStack | null
): string {

  const names = selectedFiles.map(f => path.basename(f).toLowerCase());

  const has = (k: string) => names.some(f => f.includes(k));

  // 🔥 Frontend static flow
  if (techStack?.frontend.includes('Static Website')) {
    const steps: string[] = [];

    steps.push('User opens index.html');

    if (has('page')) {
      steps.push('Navigates between multiple pages');
    }

    if (has('.js') || has('script')) {
      steps.push('JavaScript handles interactions and UI behavior');
    }

    if (has('.css') || has('style')) {
      steps.push('CSS renders layout and styling');
    }

    return steps.join(' → ');
  }

  // 🔥 Backend flow (keep yours)
  const steps: string[] = [];

  if (has('auth') || has('user')) steps.push('User registers / logs in');
  if (has('product') || has('food')) steps.push('Browse items');
  if (has('cart')) steps.push('Add to cart');
  if (has('order')) steps.push('Place order');

  if (steps.length === 0) {
    return 'Client sends request → Middleware validates → Controller processes → Response returned';
  }

  return steps.join(' → ');
}
// ── Detect dependency insights ────────────────────────────────────────────
interface DepInsight {
  file: string;
  dependsOn: string[];
  reason: string;
}

function buildDepInsights(
  selectedFiles: string[],
  rootPath: string
): DepInsight[] {
  const insights: DepInsight[] = [];

  for (const fp of selectedFiles) {
    const base = path.basename(fp).toLowerCase();
    const rel = path.relative(rootPath, fp).replace(/\\/g, '/');

    if (!base.includes('controller') && !base.includes('route')) continue;
    if (isBinaryOrLockFile(fp)) continue;

    const deps = detectDeps(fp).filter(d => !d.includes('(pkg)') && !d.includes('(CDN)'));
    if (deps.length === 0) continue;

    const isController = base.includes('controller');
    const isRoute = base.includes('route');

    let reason = '';
    if (isController) {
      reason = `Needs ${deps.map(d => path.basename(d)).join(', ')} to read/write data and send responses`;
    } else if (isRoute) {
      reason = `Connects HTTP endpoints to ${deps.map(d => path.basename(d)).join(', ')}`;
    }

    insights.push({ file: rel, dependsOn: deps, reason });
  }

  return insights.slice(0, 6);
}

// ── Build architecture tree section ──────────────────────────────────────
interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  fullPath?: string;
}

// ─────────────────────────────────────────────
// Build hierarchical tree
// ─────────────────────────────────────────────
function buildTree(paths: string[], rootPath: string): TreeNode {
  const root: TreeNode = {
    name: path.basename(rootPath),
    children: new Map(),
  };

  for (const relPath of paths) {
    const parts = relPath.split('/');
    let current = root;
    let currentFullPath = rootPath;

    for (const part of parts) {
      currentFullPath = path.join(currentFullPath, part);

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          children: new Map(),
          fullPath: currentFullPath,
        });
      }

      current = current.children.get(part)!;
    }
  }

  return root;
}

// ─────────────────────────────────────────────
// Clean dependency label
// ─────────────────────────────────────────────
function cleanDep(dep: string): string {
  return dep.replace(/\s*\(pkg\)|\s*\(CDN\)/g, '');
}

// ─────────────────────────────────────────────
// Render pretty tree
// ─────────────────────────────────────────────
function renderTreePretty(
  node: TreeNode,
  prefix = '',
  isLast = true,
  isRoot = false
): string[] {
  const lines: string[] = [];

  // ROOT (no └──)
  if (isRoot) {
    lines.push(node.name + '/');
  } else {
    const connector = isLast ? '└── ' : '├── ';

    if (node.fullPath && !node.children.size) {
      const meta = getFileMeta(node.fullPath);
      lines.push(
        `${prefix}${connector}${node.name} (${meta.lines} lines, ${meta.sizeKb} KB)`
      );
    } else {
      lines.push(prefix + connector + node.name);
    }
  }

  const newPrefix = isRoot
    ? ''
    : prefix + (isLast ? '    ' : '│   ');

  const children = Array.from(node.children.values());

  children.forEach((child, index) => {
    const last = index === children.length - 1;

    lines.push(...renderTreePretty(child, newPrefix, last, false));

    // Add dependencies for files only
    if (child.fullPath && !child.children.size) {
      const deps = detectDeps(child.fullPath).map(cleanDep);

      if (deps.length === 0) {
        lines.push(
          newPrefix +
          (last ? '    ' : '│   ') +
          '└── (no external dependencies)'
        );
      } else {
        deps.forEach((dep, i) => {
          const depPrefix =
            newPrefix +
            (last ? '    ' : '│   ') +
            (i === deps.length - 1 ? '└── ' : '├── ');
          lines.push(depPrefix + 'uses → ' + dep);
        });
      }
    }
  });

  return lines;
}

// ─────────────────────────────────────────────
// FINAL TREE BUILDER
// ─────────────────────────────────────────────
function buildArchitectureTree(
  selectedFiles: string[],
  rootPath: string,
  gitCommits: GitCommit[]
): string[] {
  const lines: string[] = [];

  lines.push('## 🌳 Project Architecture Tree\n');
  lines.push('```');

  // Filter valid files
  const relPaths = selectedFiles
    .filter(fp => {
      const base = path.basename(fp);
      return (
        !IGNORE_IN_TREE.has(base) &&
        !LOCK_FILES.has(base) &&
        !isBinaryOrLockFile(fp)
      );
    })
    .map(fp => path.relative(rootPath, fp).replace(/\\/g, '/'));

  const tree = buildTree(relPaths, rootPath);

  // Render tree
  lines.push(...renderTreePretty(tree, '', true, true));

  lines.push('```\n');

  // Git commits
  lines.push('## 🕐 Last 5 Commits\n');

  if (gitCommits.length) {
    gitCommits.slice(0, 5).forEach(c => {
      lines.push(
        `- \`${c.hash}\` | ${c.author} | ${c.relativeDate} | ${c.message}`
      );
    });
  } else {
    lines.push('_No git history found._');
  }

  lines.push('');

  return lines;
}

export interface MarkdownInput {
  projectName: string;
  rootPath: string;
  techStack: TechStack | null;
  tree: FolderNode[];
  keyFiles: string[];
  gitCommits: GitCommit[];
  selectedFiles: string[];
  treeFlat?: string[];
  mode: GenerateMode;
}
function generateSmartOverview(input: MarkdownInput): string[] {
  const lines: string[] = [];

  const ts = input.techStack;
  const project = input.projectName;

  const files = input.treeFlat ?? [];
  const names = files.map(f => path.basename(f).toLowerCase());

  const has = (k: string) => names.some(f => f.includes(k));

  let desc = `**${project}**`;

  // 🎯 Detect project type
  if (ts?.frontend.includes('Static Website')) {
    desc += ` is a static frontend website built using HTML, CSS, and JavaScript.`;

    if (has('m2') || has('m3') || has('m4')) {
      desc += ` It showcases BMW car models across multiple pages (M2, M3, M4).`;
    } else if (has('page')) {
      desc += ` It contains multiple UI pages for navigation and content display.`;
    }

  } else if (ts?.backend.length) {
    desc += ` is a backend API built with ${ts.backend.join(', ')}`;

    if (ts.database.length) {
      desc += ` and ${ts.database.join(', ')}`;
    }

    desc += `.`;

  } else if (ts?.frontend.length) {
    desc += ` is a frontend application built with ${ts.frontend.join(', ')}.`;

  } else {
    desc += ` is a ${ts?.languages.join(', ') || 'software'} project.`;
  }

  lines.push(desc);

  return lines;
}

export function buildMarkdown(input: MarkdownInput): string {
  const cfg = vscode.workspace.getConfiguration('aibridge');
  const now = new Date().toLocaleString();
  const lines: string[] = [];

  const modeLabel: Record<GenerateMode, string> = {
    basic: '⚡ Basic',
    tree: '🌳 Project Tree',
    full: '📄 Full Code',
  };

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(`# AIBridge — ${input.projectName}`);
  lines.push(`> Generated on ${now}  |  Mode: ${modeLabel[input.mode]}`);
  lines.push(`> Paste into ChatGPT, Claude, Gemini, or any AI tool.\n`);
  lines.push('---\n');

  // ── 1. PROJECT OVERVIEW ───────────────────────────────────────────────────
  lines.push('## 📋 Project Overview\n');
  lines.push(...generateSmartOverview(input));
  lines.push('');

  if (input.techStack) {
    const isBackend = input.techStack.backend.length > 0;
    const hasMongo = input.techStack.database.some(d => d.toLowerCase().includes('mongo'));
    const hasPostgres = input.techStack.database.some(d => d.toLowerCase().includes('postgres'));
    const hasStripe = input.techStack.other.includes('Stripe');
    const hasAuth = input.techStack.other.includes('JWT');
    const isFrontend = input.techStack.frontend.length > 0;

    let overview = `**${input.projectName}**`;

    if (isBackend && isFrontend) {
      overview += ` is a full-stack application built with ${[...input.techStack.frontend, ...input.techStack.backend].slice(0, 3).join(', ')}.`;
    } else if (isBackend) {
      overview += ` is a backend REST API built with ${input.techStack.backend.join(', ')}`;
      if (input.techStack.database.length) {
        overview += ` and ${input.techStack.database.join(', ')}`;
      }
      overview += '.';
    } else if (isFrontend) {
      overview += ` is a frontend application built with ${input.techStack.frontend.join(', ')}.`;
    } else {
      overview += ` is a ${input.techStack.languages.join(', ')} project.`;
    }

    lines.push(overview);

    // Purpose detection
    const fileNames = input.selectedFiles.map(f => path.basename(f).toLowerCase());
    const has = (k: string) => fileNames.some(f => f.includes(k));

    if (has('order') && has('food')) {
      lines.push('It powers a **food ordering platform** — handling restaurants, menus, cart, orders' + (hasStripe ? ', and payments' : '') + '.');
    } else if (has('order') && has('product')) {
      lines.push('It powers an **e-commerce platform** — handling products, cart, orders' + (hasStripe ? ', and payments' : '') + '.');
    } else if (has('auth') && hasAuth) {
      lines.push('It includes a full **authentication system** using JWT tokens for secure session management.');
    }

    if (hasAuth) {
      lines.push('Protected routes use JWT-based authentication middleware.');
    }
  } else {
    lines.push(`**${input.projectName}** — static project.`);
  }
  lines.push('');

  // ── 2. CORE ARCHITECTURE ──────────────────────────────────────────────────
  lines.push('## 🏗 Core Architecture\n');

  if (input.techStack?.backend.length) {
    const fileNames = input.selectedFiles.map(f => path.basename(f).toLowerCase());
    const has = (k: string) => fileNames.some(f => f.includes(k));

    const layers: Array<{ name: string; desc: string }> = [];

    if (has('route')) layers.push({ name: 'Routes', desc: 'Define HTTP endpoints and map them to controller functions' });
    if (has('controller')) layers.push({ name: 'Controllers', desc: 'Handle request logic — validate input, call models, return responses' });
    if (has('middleware')) layers.push({ name: 'Middleware', desc: 'Intercept requests — handle auth, roles, validation, errors' });
    if (has('model')) layers.push({ name: 'Models', desc: 'Define database schemas and interact with the database' });
    if (has('util') || has('helper')) {
      layers.push({ name: 'Utils', desc: 'Shared helpers — token generation, response formatting, etc.' });
    }
    if (has('config')) layers.push({ name: 'Config', desc: 'Database connection and app-level configuration' });

    if (layers.length > 0) {
      layers.forEach(l => lines.push(`- **${l.name}** — ${l.desc}`));
    } else {
      lines.push('- Standard MVC pattern — routes, controllers, models');
    }
  } else {
    lines.push('- Static project — no server-side architecture detected');
  }
  lines.push('');

  // ── 3. API SUMMARY ────────────────────────────────────────────────────────
  const routeFiles = input.selectedFiles.filter(fp =>
    path.basename(fp).toLowerCase().includes('route') &&
    !isBinaryOrLockFile(fp)
  );

  if (routeFiles.length > 0) {
    lines.push('## 🔌 API Endpoints\n');

    const allEndpoints: ApiEndpoint[] = [];
    for (const fp of routeFiles) {
      allEndpoints.push(...extractEndpoints(fp, input.rootPath));
    }

    if (allEndpoints.length > 0) {
      // Group by base path
      const groups = new Map<string, ApiEndpoint[]>();
      for (const ep of allEndpoints) {
        const base = ep.path.split('/')[1] ?? 'root';
        if (!groups.has(base)) groups.set(base, []);
        groups.get(base)!.push(ep);
      }

      for (const [group, eps] of groups) {
        lines.push(`**/${group}**`);
        for (const ep of eps) {
          const handlerNote = ep.handler ? ` → ${ep.handler}` : '';
          lines.push(`- \`${ep.method}\` \`${ep.path}\`${handlerNote}`);
        }
        lines.push('');
      }
    } else {
      lines.push('_Could not auto-detect endpoints. Check route files manually._\n');
    }
  }

  // ── 4. BUSINESS FLOW ──────────────────────────────────────────────────────
  lines.push('## 🔄 Business Flow\n');
  const flow = detectBusinessFlow(input.selectedFiles, input.techStack);
  lines.push(flow + '\n');

  // ── 5. IMPORTANT FILES ────────────────────────────────────────────────────
  const importantFiles = analyzeImportantFiles(input.selectedFiles, input.rootPath);
  if (importantFiles.length > 0) {
    lines.push('## ⭐ Important Files\n');
    lines.push('| File | Role | Purpose |');
    lines.push('|---|---|---|');
    importantFiles.forEach(f =>
      lines.push(`| \`${path.basename(f.path)}\` | ${f.role} | ${f.why} |`)
    );
    lines.push('');
  }

  // ── 6. DEPENDENCY INSIGHTS ────────────────────────────────────────────────
  const insights = buildDepInsights(input.selectedFiles, input.rootPath);
  if (insights.length > 0) {
    lines.push('## 🔗 Dependency Insights\n');
    for (const ins of insights) {
      lines.push(`- **${path.basename(ins.file)}** — ${ins.reason}`);
    }
    lines.push('');
  }

  // ── 7. TECH STACK ─────────────────────────────────────────────────────────
  lines.push('## 🛠 Tech Stack\n');
  if (input.techStack) {
    const ts = input.techStack;
    if (ts.languages.length) lines.push(`- **Language:** ${ts.languages.join(', ')}`);
    if (ts.frontend.length) lines.push(`- **Frontend:** ${ts.frontend.join(', ')}`);
    if (ts.backend.length) lines.push(`- **Backend:** ${ts.backend.join(', ')}`);
    if (ts.database.length) lines.push(`- **Database:** ${ts.database.join(', ')}`);
    if (ts.testing.length) lines.push(`- **Testing:** ${ts.testing.join(', ')}`);
    if (ts.devTools.length) lines.push(`- **Dev Tools:** ${ts.devTools.join(', ')}`);
    if (ts.other.length) lines.push(`- **Other:** ${ts.other.join(', ')}`);
  } else {
    lines.push('- **Language:** HTML, CSS, JavaScript');
  }
  lines.push('');

  // ── 8. NPM SCRIPTS ────────────────────────────────────────────────────────
  if (cfg.get<boolean>('includeScripts') !== false) {
    const scripts = Object.entries(getNpmScripts(input.rootPath));
    if (scripts.length) {
      lines.push('## 🔧 Available Scripts\n');
      scripts.forEach(([k, v]) => lines.push(`- \`${k}\` → ${v}`));
      lines.push('');
    }
  }

  // ── 9. ENV VARS ───────────────────────────────────────────────────────────
  if (cfg.get<boolean>('includeEnvKeys') !== false) {
    const keys = getEnvKeys(input.rootPath);
    if (keys.length) {
      lines.push('## 🌍 Environment Variables (keys only)\n');
      keys.forEach(k => lines.push(`- ${k}`));
      lines.push('');
    }
  }

  // ── 10. MODE-SPECIFIC SECTIONS ────────────────────────────────────────────

  if (input.mode === 'basic') {

    // Folder structure
    lines.push('## 📁 Folder Structure\n');
    lines.push('```');
    lines.push(path.basename(input.rootPath) + '/');
    lines.push(renderTree(input.tree));
    lines.push('```\n');

    // Git history
    if (cfg.get<boolean>('includeGitHistory') !== false && input.gitCommits.length) {
      lines.push('## 🕐 Recent Git Activity\n');
      input.gitCommits.forEach(c =>
        lines.push(`- \`${c.hash}\` | ${c.author} | ${c.relativeDate} | ${c.message}`)
      );
      lines.push('');
    }

    // File list table
    if (input.selectedFiles.length) {
      lines.push('## 📎 Selected Files\n');
      lines.push('| File | Lines | Size |');
      lines.push('|---|---|---|');
      for (const fp of input.selectedFiles) {
        const rel = path.relative(input.rootPath, fp).replace(/\\/g, '/');
        if (isBinaryOrLockFile(fp)) {
          lines.push(`| \`${rel}\` | — | binary |`);
          continue;
        }
        const { lines: lc, sizeKb } = getFileMeta(fp);
        lines.push(`| \`${rel}\` | ${lc} | ${sizeKb} KB |`);
      }
      lines.push('');
      lines.push('> 💡 Ask the AI about any specific file and share its contents on request.\n');
    }

  } else if (input.mode === 'tree') {

    // ✅ use ALL files from scan (NOT selectedFiles)
    const allFiles = input.treeFlat ?? [];
    // fallback if not present
    const files = allFiles.length > 0
      ? allFiles
      : input.selectedFiles;

    const treeSection = buildArchitectureTree(
      files,
      input.rootPath,
      input.gitCommits
    );

    lines.push(...treeSection);



  } else if (input.mode === 'full') {

    // Full file contents
    if (input.selectedFiles.length) {
      lines.push('## 📎 Selected Files — Full Code\n');
      for (const fp of input.selectedFiles) {
        const base = path.basename(fp);
        if (IGNORE_IN_TREE.has(base) || LOCK_FILES.has(base)) continue;

        const rel = path.relative(input.rootPath, fp).replace(/\\/g, '/');
        const { content, error } = readSafe(fp);

        if (error) {
          lines.push(`> ⚠️ Skipped \`${rel}\` — ${error}\n`);
          continue;
        }

        const meta = getFileMeta(fp);
        lines.push(`### ${rel}  _(${meta.lines} lines)_`);
        lines.push('```' + getLang(fp));
        lines.push(content);
        lines.push('```\n');
      }
    }

    // Git history for full mode
    if (cfg.get<boolean>('includeGitHistory') !== false && input.gitCommits.length) {
      lines.push('## 🕐 Recent Git Activity\n');
      input.gitCommits.forEach(c =>
        lines.push(`- \`${c.hash}\` | ${c.author} | ${c.relativeDate} | ${c.message}`)
      );
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`_Generated by AIBridge — ${modeLabel[input.mode]} mode_`);

  return lines.join('\n');
}