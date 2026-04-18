import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TechStack, getNpmScripts, getEnvKeys } from './techDetector';
import { FolderNode, renderTree } from './folderScanner';
import { GitCommit } from './gitHelper';

const BINARY_EXT = new Set([
  '.png','.jpg','.jpeg','.gif','.webp','.ico','.bmp','.tiff','.avif',
  '.pdf','.zip','.tar','.gz','.rar','.7z','.exe','.dll','.so','.dylib',
  '.mp3','.mp4','.wav','.avi','.mov','.webm','.mkv','.ogg',
  '.ttf','.woff','.woff2','.eot','.otf',
  '.db','.sqlite','.sqlite3',
  '.glb','.gltf','.fbx','.obj',
  '.psd','.ai','.sketch','.fig',
  '.class','.jar','.pyc','.o','.a',
  '.bin','.dat','.iso','.svg',
]);

const LOCK_FILES = new Set([
  'package-lock.json','yarn.lock','pnpm-lock.yaml',
  'Cargo.lock','poetry.lock','composer.lock','Gemfile.lock',
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
    '.ts':'typescript','.tsx':'tsx',
    '.js':'javascript','.jsx':'jsx','.mjs':'javascript',
    '.json':'json','.md':'markdown',
    '.html':'html','.htm':'html',
    '.css':'css','.scss':'scss','.sass':'sass','.less':'less',
    '.py':'python','.go':'go','.rs':'rust',
    '.java':'java','.rb':'ruby','.php':'php',
    '.sh':'bash','.bash':'bash','.zsh':'bash',
    '.yaml':'yaml','.yml':'yaml','.toml':'toml',
    '.sql':'sql','.graphql':'graphql','.prisma':'prisma','.env':'bash',
  };
  const base = path.basename(filePath).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  return map[path.extname(filePath).toLowerCase()] ?? '';
}

function readSafe(fp: string): { content: string; error: string | null } {
  if (isBinaryOrLockFile(fp)) return { content: '', error: 'binary or lock file' };
  if (isFileTooLarge(fp))     return { content: '', error: 'file too large (over 50KB)' };
  let buf: Buffer;
  try { buf = fs.readFileSync(fp); }
  catch { return { content: '', error: 'could not read file' }; }
  if (hasBinaryContent(buf))  return { content: '', error: 'binary content detected' };
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

// ── Tree mode: detect what each file imports or links to ──────────────────
function detectDeps(fp: string): string[] {
  const { content, error } = readSafe(fp);
  if (error) return [];

  const deps: string[] = [];
  const ext = path.extname(fp).toLowerCase();
  const lines = content.split('\n').slice(0, 60);

  for (const line of lines) {
    // HTML: href / src attributes
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

    // JS/TS: import or require
    if (['.js','.ts','.jsx','.tsx','.mjs'].includes(ext)) {
      const imp = line.match(/(?:from|require)\s*\(?\s*['"]([^'"]+)['"]/);
      if (imp) {
        const val = imp[1];
        if (val.startsWith('.')) deps.push(val.replace(/^\.\.?\//, ''));
        else deps.push(`${val} (pkg)`);
      }
    }

    // CSS: @import
    if (['.css','.scss','.sass'].includes(ext)) {
      const imp = line.match(/@import\s+['"]([^'"]+)['"]/);
      if (imp) deps.push(imp[1].replace(/^\.\.?\//, ''));
    }
  }

  // Deduplicate
  return [...new Set(deps)].slice(0, 8);
}

// ── Build the tree mode section ───────────────────────────────────────────
function buildTreeSection(selectedFiles: string[], rootPath: string): string[] {
  const lines: string[] = [];

  lines.push('## 🌳 Project Architecture Tree\n');
  lines.push('```');
  lines.push(path.basename(rootPath) + '/');

  for (const fp of selectedFiles) {
    const rel = path.relative(rootPath, fp).replace(/\\/g, '/');

    if (isBinaryOrLockFile(fp)) {
      lines.push(`├── ${rel}  [binary — skipped]`);
      continue;
    }

    const deps = detectDeps(fp);
    const meta = getFileMeta(fp);

    lines.push(`├── ${rel}  (${meta.lines} lines, ${meta.sizeKb} KB)`);

    if (deps.length > 0) {
      deps.forEach((dep, i) => {
        const isLast = i === deps.length - 1;
        lines.push(`│   ${isLast ? '└──' : '├──'} uses → ${dep}`);
      });
    }
  }

  lines.push('```\n');

  // Last 5 commits
  lines.push('## 🕐 Last 5 Commits\n');

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
  mode: GenerateMode;
}

export function buildMarkdown(input: MarkdownInput): string {
  const cfg = vscode.workspace.getConfiguration('aibridge');
  const now = new Date().toLocaleString();
  const lines: string[] = [];

  const modeLabel: Record<GenerateMode, string> = {
    basic: '⚡ Basic',
    tree:  '🌳 Project Tree',
    full:  '📄 Full Code',
  };

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(`# AIBridge — ${input.projectName}`);
  lines.push(`> Generated on ${now}  |  Mode: ${modeLabel[input.mode]}`);
  lines.push(`> Paste into ChatGPT, Claude, Gemini, or any AI tool.\n`);
  lines.push('---\n');

  // ── Project Summary ───────────────────────────────────────────────────────
  lines.push('## 📋 Project Summary\n');
  if (input.techStack) {
    const top = [
      ...input.techStack.languages,
      ...input.techStack.frontend,
      ...input.techStack.backend,
    ].slice(0, 4).join(', ');
    lines.push(`**${input.projectName}** is built with ${top || 'HTML, CSS, JavaScript'}.`);
    if (input.techStack.backend.length)  lines.push(`Backend: ${input.techStack.backend.join(', ')}.`);
    if (input.techStack.database.length) lines.push(`Database: ${input.techStack.database.join(', ')}.`);
  } else {
    lines.push(`**${input.projectName}** — static frontend project.`);
  }
  lines.push('');

  // ── Tech Stack ────────────────────────────────────────────────────────────
  lines.push('## 🛠 Tech Stack\n');
  if (input.techStack) {
    const ts = input.techStack;
    if (ts.languages.length) lines.push(`- **Language:** ${ts.languages.join(', ')}`);
    if (ts.frontend.length)  lines.push(`- **Frontend:** ${ts.frontend.join(', ')}`);
    if (ts.backend.length)   lines.push(`- **Backend:** ${ts.backend.join(', ')}`);
    if (ts.database.length)  lines.push(`- **Database:** ${ts.database.join(', ')}`);
    if (ts.testing.length)   lines.push(`- **Testing:** ${ts.testing.join(', ')}`);
    if (ts.devTools.length)  lines.push(`- **Dev Tools:** ${ts.devTools.join(', ')}`);
    if (ts.other.length)     lines.push(`- **Other:** ${ts.other.join(', ')}`);
  } else {
    lines.push('- **Language:** HTML, CSS, JavaScript');
  }
  lines.push('');

  // ── Folder Structure ──────────────────────────────────────────────────────
  lines.push('## 📁 Folder Structure\n');
  lines.push('```');
  lines.push(path.basename(input.rootPath) + '/');
  lines.push(renderTree(input.tree));
  lines.push('```\n');

  // ── Key Files ─────────────────────────────────────────────────────────────
  if (input.keyFiles.length) {
    lines.push('## 📄 Key Files\n');
    input.keyFiles.forEach(f => lines.push(`- \`${f}\``));
    lines.push('');
  }

  // ── NPM Scripts ───────────────────────────────────────────────────────────
  if (cfg.get<boolean>('includeScripts') !== false) {
    const scripts = Object.entries(getNpmScripts(input.rootPath));
    if (scripts.length) {
      lines.push('## 🔧 Available Scripts\n');
      scripts.forEach(([k, v]) => lines.push(`- \`${k}\` → ${v}`));
      lines.push('');
    }
  }

  // ── Environment Variables ─────────────────────────────────────────────────
  if (cfg.get<boolean>('includeEnvKeys') !== false) {
    const keys = getEnvKeys(input.rootPath);
    if (keys.length) {
      lines.push('## 🌍 Environment Variables (keys only)\n');
      keys.forEach(k => lines.push(`- ${k}`));
      lines.push('');
    }
  }

  // ── Git History ───────────────────────────────────────────────────────────
  if (cfg.get<boolean>('includeGitHistory') !== false && input.gitCommits.length) {
    const count = input.mode === 'tree' ? 5 : input.gitCommits.length;
    lines.push('## 🕐 Recent Git Activity\n');
    input.gitCommits.slice(0, count).forEach(c =>
      lines.push(`- \`${c.hash}\` | ${c.author} | ${c.relativeDate} | ${c.message}`)
    );
    lines.push('');
  }

  // ── Mode-specific section ─────────────────────────────────────────────────

  if (input.mode === 'basic') {
    // BASIC — file list with metadata only, no code
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
  }

  else if (input.mode === 'tree') {
    // TREE — visual architecture with file connections
    if (input.selectedFiles.length) {
      const treeSection = buildTreeSection(input.selectedFiles, input.rootPath);
      lines.push(...treeSection);

      // Add last 5 commits again specifically for tree mode (already shown above)
      // so we skip duplicate — just add architecture note
      lines.push('> 💡 Tree shows each file and what it imports or links to.\n');
    } else {
      lines.push('## 🌳 Project Architecture\n');
      lines.push('> No files selected. Select files in the AIBridge panel to see their connections.\n');
    }
  }

  else if (input.mode === 'full') {
    // FULL — complete code of every selected file
    if (input.selectedFiles.length) {
      lines.push('## 📎 Selected Files — Full Code\n');
      for (const fp of input.selectedFiles) {
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
  }

  lines.push('---');
  lines.push(`_Generated by AIBridge — ${modeLabel[input.mode]} mode_`);

  return lines.join('\n');
}