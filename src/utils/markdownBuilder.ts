import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TechStack, getNpmScripts, getEnvKeys } from './techDetector';
import { FolderNode, renderTree } from './folderScanner';
import { GitCommit } from './gitHelper';

// ─── Skip lists ───────────────────────────────────────────────────────────────

const BINARY_EXT = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.avif', '.svg',
  // Video/Audio
  '.mp4', '.mp3', '.wav', '.avi', '.mov', '.webm', '.mkv', '.ogg', '.flac',
  // Archives
  '.zip', '.tar', '.gz', '.rar', '.7z', '.dmg', '.iso',
  // Compiled/binary
  '.exe', '.dll', '.so', '.dylib', '.class', '.jar', '.pyc', '.pyo', '.o', '.a', '.bin',
  // Fonts
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  // DB
  '.db', '.sqlite', '.sqlite3',
  // Design/3D
  '.glb', '.gltf', '.fbx', '.obj', '.psd', '.ai', '.sketch', '.fig', '.xd',
  // Docs
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Flutter/Android/iOS compiled
  '.dill', '.snapshot', '.aot', '.apk', '.aab', '.aar', '.dex', '.ipa',
  // Misc
  '.dat', '.log',
]);

const LOCK_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
  'Cargo.lock', 'poetry.lock', 'Pipfile.lock', 'Gemfile.lock',
  'composer.lock', 'pubspec.lock', 'go.sum',
]);

const IGNORE_FILES = new Set([
  // Generated
  'aicodebrdige.md', 'contextflow.md', 'aibridge.md',
  // Lint/format config
  '.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.yml',
  '.prettierrc', '.prettierrc.json', '.prettierrc.js',
  '.editorconfig', '.browserslistrc', '.gitignore', '.eslintignore',
  // Env
  '.env', '.env.local', '.env.development', '.env.production', '.env.test',
  // Deploy
  'vercel.json', 'netlify.toml', 'railway.json', 'fly.toml', 'render.yaml',
  // CI
  '.travis.yml', 'circle.yml', 'Jenkinsfile',
  // Flutter
  '.flutter-plugins', '.flutter-plugins-dependencies', '.metadata',
  // Android
  'gradlew', 'gradlew.bat', 'local.properties',
  // Misc
  'CHANGELOG.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', '.vscodeignore',
]);

const MAX_FILE_SIZE = 50 * 1024;

export type GenerateMode = 'basic' | 'tree' | 'full';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isBinaryOrLockFile(fp: string): boolean {
  return (
    BINARY_EXT.has(path.extname(fp).toLowerCase()) ||
    LOCK_FILES.has(path.basename(fp)) ||
    IGNORE_FILES.has(path.basename(fp))
  );
}

function isTooBig(fp: string): boolean {
  try { return fs.statSync(fp).size > MAX_FILE_SIZE; } catch { return true; }
}

function hasBinaryContent(buf: Buffer): boolean {
  const s = buf.slice(0, 512);
  let bad = 0;
  for (let i = 0; i < s.length; i++) {
    const b = s[i];
    if (b === 0) return true;
    if (b < 8 || (b > 13 && b < 32 && b !== 27)) bad++;
  }
  return bad / s.length > 0.1;
}

function getLang(fp: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
    '.mjs': 'javascript', '.json': 'json', '.md': 'markdown',
    '.html': 'html', '.css': 'css', '.scss': 'scss', '.sass': 'sass',
    '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.rb': 'ruby', '.php': 'php', '.sh': 'bash', '.bash': 'bash',
    '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml', '.sql': 'sql',
    '.dart': 'dart', '.swift': 'swift', '.kt': 'kotlin',
    '.xml': 'xml', '.c': 'c', '.cpp': 'cpp', '.cs': 'csharp',
  };
  const base = path.basename(fp).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  return map[path.extname(fp).toLowerCase()] ?? '';
}

function readSafe(fp: string): { content: string; error: string | null } {
  if (isBinaryOrLockFile(fp)) return { content: '', error: 'skipped' };
  if (isTooBig(fp)) return { content: '', error: 'too large' };
  let buf: Buffer;
  try { buf = fs.readFileSync(fp); } catch { return { content: '', error: 'unreadable' }; }
  if (hasBinaryContent(buf)) return { content: '', error: 'binary' };
  return { content: buf.toString('utf-8'), error: null };
}

function lineCount(fp: string): number {
  try { return fs.readFileSync(fp, 'utf-8').split('\n').length; } catch { return 0; }
}

// ─── Compact sections ─────────────────────────────────────────────────────────

function buildOverview(input: MarkdownInput): string {
  const ts = input.techStack;
  if (!ts) return `**${input.projectName}** — project.`;
  if (ts.backend.length && ts.frontend.length)
    return `**${input.projectName}** — full-stack app (${[...ts.frontend, ...ts.backend].slice(0, 3).join(', ')}).`;
  if (ts.backend.length)
    return `**${input.projectName}** — backend API (${ts.backend.join(', ')}${ts.database.length ? ` + ${ts.database.join(', ')}` : ''}).`;
  if (ts.frontend.length)
    return `**${input.projectName}** — frontend app (${ts.frontend.join(', ')}).`;
  return `**${input.projectName}** — ${ts.languages.join(', ')} project.`;
}

function buildTechStack(ts: TechStack): string[] {
  const lines: string[] = [];
  if (ts.languages.length) lines.push(`- **Lang:** ${ts.languages.join(', ')}`);
  if (ts.frontend.length)  lines.push(`- **Frontend:** ${ts.frontend.join(', ')}`);
  if (ts.backend.length)   lines.push(`- **Backend:** ${ts.backend.join(', ')}`);
  if (ts.database.length)  lines.push(`- **DB:** ${ts.database.join(', ')}`);
  if (ts.testing.length)   lines.push(`- **Test:** ${ts.testing.join(', ')}`);
  if (ts.devTools.length)  lines.push(`- **Tools:** ${ts.devTools.join(', ')}`);
  if (ts.other.length)     lines.push(`- **Other:** ${ts.other.join(', ')}`);
  return lines;
}

function buildKeyFiles(files: string[], rootPath: string): string[] {
  const roleMap = [
    { p: /server\.(js|ts)$/i,   role: 'Entry' },
    { p: /index\.(js|ts)$/i,    role: 'Root' },
    { p: /controller/i,         role: 'Controller' },
    { p: /route/i,              role: 'Route' },
    { p: /middleware/i,         role: 'Middleware' },
    { p: /model/i,              role: 'Model' },
    { p: /db\.(js|ts)$/i,       role: 'Database' },
    { p: /auth/i,               role: 'Auth' },
  ];
  const found: string[] = [];
  for (const fp of files) {
    if (isBinaryOrLockFile(fp)) continue;
    const base = path.basename(fp);
    const rel = path.relative(rootPath, fp).replace(/\\/g, '/');
    for (const r of roleMap) {
      if (r.p.test(base)) { found.push(`- \`${rel}\` — ${r.role}`); break; }
    }
  }
  return found.slice(0, 8);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

export function buildMarkdown(input: MarkdownInput): string {
  const cfg = vscode.workspace.getConfiguration('aicodebrdige');
  const lines: string[] = [];
  const ts = input.techStack;

  const modeLabel: Record<GenerateMode, string> = {
    basic: '⚡ Basic', tree: '🌳 Tree', full: '📄 Full',
  };

  // Compact header
  lines.push(`# ${input.projectName} — AICodeBridge`);
  lines.push(`> ${new Date().toLocaleString()} | ${modeLabel[input.mode]}\n`);
  lines.push('---\n');

  // Overview — one line
  lines.push(buildOverview(input) + '\n');

  // Tech stack — compact
  if (ts) {
    lines.push('## 🛠 Stack\n');
    lines.push(...buildTechStack(ts));
    lines.push('');
  }

  // Scripts — compact, only if present
  if (cfg.get<boolean>('includeScripts') !== false) {
    const scripts = Object.entries(getNpmScripts(input.rootPath));
    if (scripts.length) {
      lines.push('## 🔧 Scripts\n');
      scripts.slice(0, 6).forEach(([k, v]) => lines.push(`- \`${k}\` → ${v}`));
      lines.push('');
    }
  }

  // Env keys
  if (cfg.get<boolean>('includeEnvKeys') !== false) {
    const keys = getEnvKeys(input.rootPath);
    if (keys.length) {
      lines.push('## 🌍 Env Keys\n');
      lines.push(keys.join(', ') + '\n');
    }
  }

  // Mode-specific
  if (input.mode === 'basic') {
    // Folder structure
    lines.push('## 📁 Structure\n```');
    lines.push(path.basename(input.rootPath) + '/');
    lines.push(renderTree(input.tree).trimEnd());
    lines.push('```\n');

    // Key files
    const keyFiles = buildKeyFiles(input.treeFlat ?? [], input.rootPath);
    if (keyFiles.length) {
      lines.push('## ⭐ Key Files\n');
      lines.push(...keyFiles);
      lines.push('');
    }

    // Git — max 5 commits, short format
    if (cfg.get<boolean>('includeGitHistory') !== false && input.gitCommits.length) {
      lines.push('## 🕐 Git\n');
      input.gitCommits.slice(0, 5).forEach(c =>
        lines.push(`- \`${c.hash}\` ${c.relativeDate} — ${c.message}`)
      );
      lines.push('');
    }

  } else if (input.mode === 'tree') {
    lines.push('## 📁 Structure\n```');
    lines.push(path.basename(input.rootPath) + '/');
    lines.push(renderTree(input.tree).trimEnd());
    lines.push('```\n');

    if (input.gitCommits.length) {
      lines.push('## 🕐 Git\n');
      input.gitCommits.slice(0, 5).forEach(c =>
        lines.push(`- \`${c.hash}\` ${c.relativeDate} — ${c.message}`)
      );
      lines.push('');
    }

  } else if (input.mode === 'full' && input.selectedFiles.length) {
    // Key files summary first
    const keyFiles = buildKeyFiles(input.selectedFiles, input.rootPath);
    if (keyFiles.length) {
      lines.push('## ⭐ Key Files\n');
      lines.push(...keyFiles);
      lines.push('');
    }

    // Full code
    lines.push('## 📎 Code\n');
    for (const fp of input.selectedFiles) {
      if (isBinaryOrLockFile(fp)) continue;
      const rel = path.relative(input.rootPath, fp).replace(/\\/g, '/');
      const { content, error } = readSafe(fp);
      if (error) { lines.push(`> ⚠️ \`${rel}\` — ${error}\n`); continue; }
      lines.push(`### ${rel} _(${lineCount(fp)} lines)_`);
      lines.push('```' + getLang(fp));
      lines.push(content.trimEnd());
      lines.push('```\n');
    }

    if (cfg.get<boolean>('includeGitHistory') !== false && input.gitCommits.length) {
      lines.push('## 🕐 Git\n');
      input.gitCommits.slice(0, 5).forEach(c =>
        lines.push(`- \`${c.hash}\` ${c.relativeDate} — ${c.message}`)
      );
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`_AICodeBridge — ${modeLabel[input.mode]}_`);

  return lines.join('\n');
}