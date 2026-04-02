/**
 * RemoteOperations factory — creates a ProjectOperations object that delegates
 * all filesystem methods to the ccud daemon via JSON-RPC over SSH.
 *
 * Error codes from the daemon's JSON-RPC responses are translated back to
 * Node.js-style fs error codes so that existing route error handlers work
 * identically for both local and remote projects.
 *
 * @module remote/remote-operations
 */

import { getConnection } from './connection-manager.js';

// ────────────────────────────────────────────────────────────────────────────
// Error code translation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Maps daemon JSON-RPC error codes to Node.js filesystem error codes.
 * The daemon (ccud/src/handlers/fs.js) uses:
 *   ENOENT -> -32001, EACCES/EPERM -> -32002, EEXIST -> -32003,
 *   ENOTEMPTY -> -32004, ENOSPC -> -32005
 */
const RPC_TO_FS_CODES = {
  '-32001': 'ENOENT',
  '-32002': 'EACCES',
  '-32003': 'EEXIST',
  '-32004': 'ENOTEMPTY',
  '-32005': 'ENOSPC',
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Verify that the connection for a given host is active and ready.
 * @param {string} hostId
 * @returns {import('./connection-manager.js').SSHConnectionManager}
 * @throws {Error} With code ECONNREFUSED if not connected
 */
function requireConnection(hostId) {
  const conn = getConnection(hostId);
  if (!conn || !conn.isReady) {
    const err = new Error('Remote host not connected');
    err.code = 'ECONNREFUSED';
    throw err;
  }
  return conn;
}

/**
 * Send a JSON-RPC request through the connection's transport and translate
 * any daemon error codes to Node.js-style fs error codes.
 * @param {import('./connection-manager.js').SSHConnectionManager} conn
 * @param {string} method - RPC method name (e.g. 'fs/readFile')
 * @param {object} params - RPC parameters
 * @returns {Promise<any>}
 */
async function rpcRequest(conn, method, params) {
  try {
    return await conn.transport.request(method, params);
  } catch (err) {
    // SSHTransport throws errors with .code and .message from JSON-RPC error responses
    const fsCode = RPC_TO_FS_CODES[String(err.code)];
    if (fsCode) {
      const fsErr = new Error(err.message);
      fsErr.code = fsCode;
      throw fsErr;
    }
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a ProjectOperations object backed by the ccud daemon on a remote host.
 *
 * All filesystem methods delegate to the daemon via JSON-RPC calls through
 * SSHTransport. Error codes are translated so route error handlers work
 * identically to local operations.
 *
 * @param {string} hostId - ID of the remote host (from remote_hosts table)
 * @returns {import('./operations.js').ProjectOperations}
 */
export function createRemoteOperations(hostId) {
  return {
    /**
     * List files in a remote directory tree.
     * Daemon fs/readdir returns FileTreeNode[] directly.
     * @param {string} dirPath - Absolute path on the remote host
     * @param {object} [options]
     * @param {number} [options.maxDepth=10]
     * @param {boolean} [options.showHidden=true]
     * @returns {Promise<import('./operations.js').FileTreeNode[]>}
     */
    async listFiles(dirPath, options = {}) {
      const conn = requireConnection(hostId);
      return rpcRequest(conn, 'fs/readdir', {
        path: dirPath,
        maxDepth: options.maxDepth ?? 10,
        showHidden: options.showHidden ?? true,
      });
    },

    /**
     * Read a file's text content from the remote host.
     * Unwraps the { content } envelope from the daemon response.
     * @param {string} filePath - Absolute path on the remote host
     * @returns {Promise<string>}
     */
    async readFile(filePath) {
      const conn = requireConnection(hostId);
      const result = await rpcRequest(conn, 'fs/readFile', { path: filePath });
      return result.content;
    },

    /**
     * Binary file preview is not available for remote projects.
     * JSON-RPC cannot efficiently transfer binary data; deferred per research.
     * @param {string} _filePath
     * @returns {Promise<never>}
     */
    async readFileBinary(_filePath) {
      throw Object.assign(
        new Error('Binary file preview not available for remote projects'),
        { code: 'ENOTSUP' },
      );
    },

    /**
     * Write text content to a file on the remote host.
     * @param {string} filePath - Absolute path on the remote host
     * @param {string} content - UTF-8 text content
     * @returns {Promise<void>}
     */
    async writeFile(filePath, content) {
      const conn = requireConnection(hostId);
      await rpcRequest(conn, 'fs/writeFile', { path: filePath, content });
    },

    /**
     * Create a new file or directory on the remote host.
     * @param {string} parentPath - Directory in which to create the item
     * @param {string} name - Name of the new item
     * @param {'file' | 'directory'} type
     * @returns {Promise<{path: string, name: string, type: string}>}
     */
    async createItem(parentPath, name, type) {
      const conn = requireConnection(hostId);
      return rpcRequest(conn, 'fs/create', { path: parentPath, name, type });
    },

    /**
     * Rename a file or directory on the remote host.
     * @param {string} oldPath - Current absolute path
     * @param {string} newName - New name (not a full path)
     * @returns {Promise<{oldPath: string, newPath: string, newName: string}>}
     */
    async renameItem(oldPath, newName) {
      const conn = requireConnection(hostId);
      return rpcRequest(conn, 'fs/rename', { oldPath, newName });
    },

    /**
     * Delete a file or directory on the remote host.
     * @param {string} targetPath - Absolute path to delete
     * @returns {Promise<void>}
     */
    async deleteItem(targetPath) {
      const conn = requireConnection(hostId);
      await rpcRequest(conn, 'fs/delete', { path: targetPath });
    },

    /**
     * Get file/directory stats from the remote host.
     * @param {string} targetPath - Absolute path
     * @returns {Promise<{size: number, modified: string, type: string, permissions: string, permissionsRwx: string}>}
     */
    async stat(targetPath) {
      const conn = requireConnection(hostId);
      return rpcRequest(conn, 'fs/stat', { path: targetPath });
    },

    /**
     * Check if a path exists on the remote host.
     * Unwraps the { exists } envelope from the daemon response.
     * @param {string} targetPath - Absolute path
     * @returns {Promise<boolean>}
     */
    async exists(targetPath) {
      const conn = requireConnection(hostId);
      const result = await rpcRequest(conn, 'fs/exists', { path: targetPath });
      return result.exists;
    },

    /**
     * Remote shell is handled separately via ssh2 client.shell() channels,
     * not through daemon JSON-RPC. See Plan 04 for implementation.
     * @param {import('./operations.js').ShellOptions} _options
     * @returns {Promise<never>}
     */
    async spawnShell(_options) {
      throw new Error('Remote shell not implemented in remote-operations — use ssh2 client.shell() directly');
    },
  };
}
