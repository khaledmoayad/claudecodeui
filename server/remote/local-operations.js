/**
 * LocalOperations — implements the ProjectOperations filesystem and terminal
 * methods for the local machine using fs/promises and node-pty.
 *
 * Git methods from the ProjectOperations typedef are NOT implemented here.
 * The existing `server/routes/git.js` uses its own `spawnAsync('git', ...)`
 * calls directly. Git implementations will be added when those routes are
 * migrated to use ProjectOperations.
 *
 * @module remote/local-operations
 */

import { promises as fsPromises } from 'fs';
import fs from 'fs';
import path from 'path';
import pty from 'node-pty';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert a single permission digit (0-7) to its rwx string.
 * Copied from server/index.js to keep local-operations self-contained.
 * @param {number} perm
 * @returns {string}
 */
function permToRwx(perm) {
  const r = perm & 4 ? 'r' : '-';
  const w = perm & 2 ? 'w' : '-';
  const x = perm & 1 ? 'x' : '-';
  return r + w + x;
}

/**
 * Directories that are always skipped when listing files.
 * Matches the skip list in server/index.js getFileTree().
 */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.svn', '.hg']);

// ────────────────────────────────────────────────────────────────────────────
// LocalOperations
// ────────────────────────────────────────────────────────────────────────────

export const localOperations = {
  /**
   * Recursively list files and directories, producing the same shape as the
   * existing getFileTree() in server/index.js.
   *
   * @param {string} dirPath - Absolute path to the directory
   * @param {{ maxDepth?: number, showHidden?: boolean }} [options]
   * @returns {Promise<import('./operations.js').FileTreeNode[]>}
   */
  async listFiles(dirPath, options = {}) {
    const maxDepth = options.maxDepth ?? 3;
    const showHidden = options.showHidden ?? true;

    async function walk(currentPath, currentDepth) {
      const items = [];

      try {
        const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          // Skip heavy build directories and VCS directories
          if (SKIP_DIRS.has(entry.name)) continue;

          // Skip hidden files when showHidden is false
          if (!showHidden && entry.name.startsWith('.')) continue;

          const itemPath = path.join(currentPath, entry.name);
          const item = {
            name: entry.name,
            path: itemPath,
            type: entry.isDirectory() ? 'directory' : 'file',
          };

          // Get file stats for additional metadata
          try {
            const stats = await fsPromises.stat(itemPath);
            item.size = stats.size;
            item.modified = stats.mtime.toISOString();

            // Convert permissions to octal + rwx format
            const mode = stats.mode;
            const ownerPerm = (mode >> 6) & 7;
            const groupPerm = (mode >> 3) & 7;
            const otherPerm = mode & 7;
            item.permissions = ownerPerm.toString() + groupPerm.toString() + otherPerm.toString();
            item.permissionsRwx = permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm);
          } catch {
            // If stat fails, provide default values
            item.size = 0;
            item.modified = null;
            item.permissions = '000';
            item.permissionsRwx = '---------';
          }

          if (entry.isDirectory() && currentDepth < maxDepth) {
            try {
              await fsPromises.access(itemPath, fs.constants.R_OK);
              item.children = await walk(itemPath, currentDepth + 1);
            } catch {
              // Silently skip directories we can't access
              item.children = [];
            }
          }

          items.push(item);
        }
      } catch (error) {
        // Only log non-permission errors to avoid spam
        if (error.code !== 'EACCES' && error.code !== 'EPERM') {
          console.error('Error reading directory:', error);
        }
      }

      // Sort: directories first, then alphabetical
      return items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    }

    return walk(dirPath, 0);
  },

  /**
   * Read a file as UTF-8 text.
   * @param {string} filePath
   * @returns {Promise<string>}
   */
  async readFile(filePath) {
    return fsPromises.readFile(filePath, 'utf8');
  },

  /**
   * Read a file as a raw Buffer (for binary content).
   * @param {string} filePath
   * @returns {Promise<Buffer>}
   */
  async readFileBinary(filePath) {
    return fsPromises.readFile(filePath);
  },

  /**
   * Write text content to a file.
   * @param {string} filePath
   * @param {string} content
   * @returns {Promise<void>}
   */
  async writeFile(filePath, content) {
    await fsPromises.writeFile(filePath, content, 'utf8');
  },

  /**
   * Create a new file or directory.
   * @param {string} parentPath - Directory in which to create the item
   * @param {string} name
   * @param {'file' | 'directory'} type
   * @returns {Promise<{path: string, name: string, type: string}>}
   */
  async createItem(parentPath, name, type) {
    const resolvedPath = path.join(parentPath, name);

    if (type === 'directory') {
      await fsPromises.mkdir(resolvedPath, { recursive: false });
    } else {
      // Ensure parent directory exists
      const parentDir = path.dirname(resolvedPath);
      await fsPromises.mkdir(parentDir, { recursive: true });
      await fsPromises.writeFile(resolvedPath, '', 'utf8');
    }

    return { path: resolvedPath, name, type };
  },

  /**
   * Rename a file or directory.
   * @param {string} oldPath
   * @param {string} newName
   * @returns {Promise<{oldPath: string, newPath: string, newName: string}>}
   */
  async renameItem(oldPath, newName) {
    const newPath = path.join(path.dirname(oldPath), newName);
    await fsPromises.rename(oldPath, newPath);
    return { oldPath, newPath, newName };
  },

  /**
   * Delete a file or directory.
   * @param {string} targetPath
   * @returns {Promise<void>}
   */
  async deleteItem(targetPath) {
    const stats = await fsPromises.stat(targetPath);
    if (stats.isDirectory()) {
      await fsPromises.rm(targetPath, { recursive: true, force: true });
    } else {
      await fsPromises.unlink(targetPath);
    }
  },

  /**
   * Get stat information for a path.
   * @param {string} targetPath
   * @returns {Promise<{size: number, modified: string, type: string, permissions: string, permissionsRwx: string}>}
   */
  async stat(targetPath) {
    const stats = await fsPromises.stat(targetPath);
    const mode = stats.mode;
    const ownerPerm = (mode >> 6) & 7;
    const groupPerm = (mode >> 3) & 7;
    const otherPerm = mode & 7;

    return {
      size: stats.size,
      modified: stats.mtime.toISOString(),
      type: stats.isDirectory() ? 'directory' : 'file',
      permissions: ownerPerm.toString() + groupPerm.toString() + otherPerm.toString(),
      permissionsRwx: permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm),
    };
  },

  /**
   * Check whether a path exists.
   * @param {string} targetPath
   * @returns {Promise<boolean>}
   */
  async exists(targetPath) {
    try {
      await fsPromises.access(targetPath);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Spawn a pseudo-terminal shell session.
   * Mirrors the pty.spawn pattern from server/index.js.
   *
   * @param {import('./operations.js').ShellOptions} options
   * @returns {Promise<import('./operations.js').ShellSession>}
   */
  async spawnShell(options) {
    const shell = options.shell || process.env.SHELL || '/bin/bash';
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd || process.env.HOME,
      env: {
        ...process.env,
        ...options.env,
        COLORTERM: 'truecolor',
        FORCE_COLOR: '3',
      },
    });

    return {
      write(data) { proc.write(data); },
      resize(cols, rows) { proc.resize(cols, rows); },
      onData(handler) { proc.onData(handler); },
      onExit(handler) { proc.onExit(handler); },
      kill() { proc.kill(); },
      pid: proc.pid,
    };
  },
};
