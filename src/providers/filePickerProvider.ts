import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getIgnoredFolders, getMaxDepth } from '../utils/folderScanner';
import { isBinaryOrLockFile } from '../utils/markdownBuilder';

export class FileItem extends vscode.TreeItem {
  children: FileItem[] = [];
  isChecked = false;

  constructor(
    public readonly absolutePath: string,
    public readonly isDirectory: boolean,
    label: string,
    state: vscode.TreeItemCollapsibleState
  ) {
    super(label, state);
    this.command = isDirectory
      ? undefined
      : { command: 'contextflow.toggleFile', title: 'Toggle', arguments: [this] };
    this.updateUI();
  }

  updateUI(): void {
    if (this.isDirectory) {
      this.iconPath = new vscode.ThemeIcon(this.isChecked ? 'folder-opened' : 'folder');
      this.description = this.isChecked ? '✓' : '';
    } else {
      this.iconPath = new vscode.ThemeIcon(this.isChecked ? 'check' : 'file');
      this.description = this.isChecked ? '✓' : '';
    }
    this.tooltip = this.isChecked
      ? `${this.label} — included in context`
      : `${this.label} — click to include`;
  }
}

export class FilePickerProvider implements vscode.TreeDataProvider<FileItem> {
  private _change = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._change.event;

  private selected = new Set<string>();
  private roots: FileItem[] = [];

  constructor(private root: string) {}

  refresh(): void {
    this.roots = [];
    this._change.fire();
  }

  getTreeItem(e: FileItem): FileItem {
    return e;
  }

  getChildren(e?: FileItem): FileItem[] {
    if (!e) {
      if (!this.roots.length) {
        this.roots = this.build(this.root, 0);
      }
      return this.roots;
    }
    return e.children;
  }

  toggle(item: FileItem): void {
    if (item.isDirectory) {
      this.setDir(item, !item.isChecked);
    } else {
      item.isChecked = !item.isChecked;
      item.isChecked
        ? this.selected.add(item.absolutePath)
        : this.selected.delete(item.absolutePath);
      item.updateUI();
    }
    this._change.fire();
  }

  selectAll(): void {
    this.setAll(this.roots, true);
    this._change.fire();
  }

  deselectAll(): void {
    this.selected.clear();
    this.setAll(this.roots, false);
    this._change.fire();
  }

  getSelected(): string[] {
    return Array.from(this.selected).filter(p => {
      try { return fs.statSync(p).isFile(); } catch { return false; }
    });
  }

  getSelectedCount(): number {
    return this.selected.size;
  }

  private setDir(item: FileItem, checked: boolean): void {
    item.isChecked = checked;
    item.updateUI();
    for (const child of item.children) {
      if (child.isDirectory) {
        this.setDir(child, checked);
      } else {
        if (isBinaryOrLockFile(child.absolutePath)) continue;
        child.isChecked = checked;
        checked
          ? this.selected.add(child.absolutePath)
          : this.selected.delete(child.absolutePath);
        child.updateUI();
      }
    }
  }

  private setAll(items: FileItem[], checked: boolean): void {
    for (const item of items) {
      if (item.isDirectory) {
        item.isChecked = checked;
        item.updateUI();
        this.setAll(item.children, checked);
      } else {
        if (isBinaryOrLockFile(item.absolutePath)) continue;
        item.isChecked = checked;
        checked
          ? this.selected.add(item.absolutePath)
          : this.selected.delete(item.absolutePath);
        item.updateUI();
      }
    }
  }

  private build(dir: string, depth: number): FileItem[] {
    if (depth > getMaxDepth()) return [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    entries.sort((a, b) => {
      if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
      return a.isDirectory() ? -1 : 1;
    });

    const items: FileItem[] = [];

    for (const e of entries) {
      if (getIgnoredFolders().includes(e.name)) continue;
      if (e.name.startsWith('.') && e.name !== '.gitignore' && !e.name.startsWith('.env')) continue;

      const full = path.join(dir, e.name);

      if (e.isDirectory()) {
        const item = new FileItem(full, true, e.name, vscode.TreeItemCollapsibleState.Collapsed);
        item.children = this.build(full, depth + 1);
        items.push(item);
      } else {
        const item = new FileItem(full, false, e.name, vscode.TreeItemCollapsibleState.None);

        if (isBinaryOrLockFile(full)) {
          item.iconPath = new vscode.ThemeIcon('circle-slash');
          item.description = 'skipped — binary';
          item.tooltip = 'Binary or lock file — automatically skipped';
          item.command = undefined;
        }

        items.push(item);
      }
    }

    return items;
  }
}