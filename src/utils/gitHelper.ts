import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as vscode from 'vscode';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitCommit {
  hash: string;
  author: string;
  relativeDate: string;
  message: string;
}

/** Check if git repo exists */
export function hasGitRepo(rootPath: string): boolean {
  return fs.existsSync(path.join(rootPath, '.git'));
}

/** Get git history (async + safe) */
export async function getGitHistory(
  rootPath: string,
  count?: number
): Promise<GitCommit[]> {

  if (!hasGitRepo(rootPath)) return [];

  const config = vscode.workspace.getConfiguration('contextflow');
  const logCount = count ?? config.get<number>('gitLogCount') ?? 10;

  try {
    const format = '%h|%an|%ar|%s';
    const command = `git log --pretty=format:"${format}" -${logCount}`;

    const { stdout } = await execAsync(command, {
      cwd: rootPath,
      timeout: 5000
    });

    return stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, author, relativeDate, ...msg] = line.split('|');
        return {
          hash: hash?.trim(),
          author: author?.trim(),
          relativeDate: relativeDate?.trim(),
          message: msg.join('|').trim()
        };
      });

  } catch {
    return [];
  }
}

/** Get current branch */
export async function getCurrentBranch(rootPath: string): Promise<string | null> {
  if (!hasGitRepo(rootPath)) return null;

  try {
    const { stdout } = await execAsync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: rootPath }
    );
    return stdout.trim();
  } catch {
    return null;
  }
}

/** Get changed files */
export async function getGitStatus(
  rootPath: string
): Promise<Array<{ status: string; file: string }>> {

  if (!hasGitRepo(rootPath)) return [];

  try {
    const { stdout } = await execAsync(
      'git status --porcelain',
      { cwd: rootPath }
    );

    return stdout
      .split('\n')
      .filter(Boolean)
      .map(line => ({
        status: line.slice(0, 2).trim(),
        file: line.slice(3).trim()
      }));

  } catch {
    return [];
  }
}

/** 🔥 NEW: Analyze commits for insights */
export function analyzeGitCommits(commits: GitCommit[]): string[] {
  const insights: string[] = [];

  const messages = commits.map(c => c.message.toLowerCase());

  const hasUI = messages.some(m =>
    m.includes('ui') || m.includes('css') || m.includes('page')
  );

  const hasFeature = messages.some(m =>
    m.includes('add') || m.includes('feature')
  );

  const hasFix = messages.some(m =>
    m.includes('fix') || m.includes('bug')
  );

  if (hasUI) insights.push('Recent changes focus on UI/frontend');
  if (hasFeature) insights.push('New features are being added');
  if (hasFix) insights.push('Bug fixes and improvements detected');

  if (insights.length === 0) {
    insights.push('General development activity detected');
  }

  return insights;
}