import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as vscode from 'vscode';

/** A single parsed git commit entry */
export interface GitCommit {
  hash: string;
  author: string;
  relativeDate: string;
  message: string;
}

/**
 * Check whether a Git repository exists at the given path.
 * @param rootPath - Workspace root path
 */
export function hasGitRepo(rootPath: string): boolean {
  return fs.existsSync(path.join(rootPath, '.git'));
}

/**
 * Read the last N git commits from the repository.
 * Uses child_process.execSync with error handling.
 * @param rootPath - Workspace root path
 * @param count - Number of commits to retrieve (default 10)
 * @returns Array of GitCommit objects, or empty array on failure
 */
export function getGitHistory(rootPath: string, count?: number): GitCommit[] {
  if (!hasGitRepo(rootPath)) {
    return [];
  }

  const config = vscode.workspace.getConfiguration('aiContextManager');
  const logCount = count ?? config.get<number>('gitLogCount') ?? 10;

  try {
    const format = '%h | %an | %ar | %s';
    const command = `git log --oneline --pretty=format:"${format}" -${logCount}`;
    const output = execSync(command, {
      cwd: rootPath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const lines = output.trim().split('\n').filter(l => l.trim());
    const commits: GitCommit[] = [];

    for (const line of lines) {
      // Remove surrounding quotes that git sometimes adds
      const clean = line.replace(/^"|"$/g, '').trim();
      const parts = clean.split(' | ');
      if (parts.length >= 4) {
        commits.push({
          hash: parts[0].trim(),
          author: parts[1].trim(),
          relativeDate: parts[2].trim(),
          message: parts.slice(3).join(' | ').trim()
        });
      }
    }

    return commits;
  } catch {
    // Git command failed — return empty array silently
    return [];
  }
}

/**
 * Get the current git branch name.
 * @param rootPath - Workspace root path
 * @returns Branch name or null if unavailable
 */
export function getCurrentBranch(rootPath: string): string | null {
  if (!hasGitRepo(rootPath)) return null;

  try {
    const output = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: rootPath,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.trim();
  } catch {
    return null;
  }
}

/**
 * Get a list of recently modified files from git status.
 * @param rootPath - Workspace root path
 * @returns Array of { status, file } objects
 */
export function getGitStatus(rootPath: string): Array<{ status: string; file: string }> {
  if (!hasGitRepo(rootPath)) return [];

  try {
    const output = execSync('git status --porcelain', {
      cwd: rootPath,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return output.trim().split('\n')
      .filter(l => l.trim())
      .map(line => ({
        status: line.substring(0, 2).trim(),
        file: line.substring(3).trim()
      }));
  } catch {
    return [];
  }
}
