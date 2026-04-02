/** @module routes/remote-connections */

import express from 'express';
import { createConnection, getConnection, removeConnection, getAllConnections } from '../remote/connection-manager.js';
import { remoteHostsDb } from '../remote/remote-hosts-db.js';
import { loadProjectConfig, saveProjectConfig } from '../projects.js';

/**
 * Create the remote-connections router.
 * @param {object} [options]
 * @param {(mgr: import('../remote/connection-manager.js').SSHConnectionManager, hostId: string) => void} [options.onConnectionCreated]
 *   Called when a new SSHConnectionManager is created, allowing the caller to
 *   attach lifecycle event listeners (e.g., reconnected, state).
 * @returns {express.Router}
 */
export default function createRemoteConnectionRoutes(options = {}) {
  const router = express.Router();
  const { onConnectionCreated } = options;

// POST /:id/connect — Establish persistent SSH connection
router.post('/:id/connect', (req, res) => {
  try {
    const host = remoteHostsDb.getById(req.params.id);
    if (!host) {
      return res.status(404).json({ error: 'Remote host not found' });
    }

    // Check if connection already exists
    const existing = getConnection(req.params.id);
    if (existing) {
      if (existing.state === 'ready') {
        return res.status(200).json({ state: 'ready', message: 'Already connected' });
      }
      if (existing.state === 'connecting' || existing.state === 'deploying' || existing.state === 'initializing') {
        return res.status(200).json({ state: existing.state, message: 'Connection in progress' });
      }
    }

    // Create connection and start lifecycle (fire-and-forget)
    const mgr = createConnection(host);

    // Allow caller to attach lifecycle listeners (reconnected, state events)
    if (onConnectionCreated) {
      onConnectionCreated(mgr, host.id);
    }

    mgr.connect().catch((err) => {
      console.error('[remote-connections] Connect error:', err.message);
    });

    return res.status(202).json({ state: mgr.state, hostId: host.id, message: 'Connection initiated' });
  } catch (err) {
    console.error('[remote-connections] POST /:id/connect error:', err);
    return res.status(500).json({ error: 'Failed to initiate connection' });
  }
});

// POST /:id/disconnect — Cleanly disconnect
router.post('/:id/disconnect', (req, res) => {
  try {
    const host = remoteHostsDb.getById(req.params.id);
    if (!host) {
      return res.status(404).json({ error: 'Remote host not found' });
    }

    const existing = getConnection(req.params.id);
    if (!existing) {
      return res.status(200).json({ state: 'disconnected', message: 'Not connected' });
    }

    removeConnection(req.params.id);
    return res.status(200).json({ state: 'disconnected', message: 'Disconnected' });
  } catch (err) {
    console.error('[remote-connections] POST /:id/disconnect error:', err);
    return res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// GET /:id/status — Get current connection state
router.get('/:id/status', (req, res) => {
  try {
    const host = remoteHostsDb.getById(req.params.id);
    if (!host) {
      return res.status(404).json({ error: 'Remote host not found' });
    }

    const mgr = getConnection(req.params.id);
    if (!mgr) {
      return res.status(200).json({ state: 'disconnected', connected: false });
    }

    return res.status(200).json({
      state: mgr.state,
      connected: mgr.isReady,
      hostId: req.params.id,
      hostName: host.name,
    });
  } catch (err) {
    console.error('[remote-connections] GET /:id/status error:', err);
    return res.status(500).json({ error: 'Failed to get connection status' });
  }
});

// GET /connections — List all active connections
router.get('/connections', (req, res) => {
  try {
    const connections = getAllConnections();
    const result = [];
    for (const [hostId, mgr] of connections) {
      result.push({ hostId, state: mgr.state, connected: mgr.isReady });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('[remote-connections] GET /connections error:', err);
    return res.status(500).json({ error: 'Failed to list connections' });
  }
});

// GET /:id/browse — Browse remote filesystem for directory picker
router.get('/:id/browse', async (req, res) => {
  try {
    const host = remoteHostsDb.getById(req.params.id);
    if (!host) {
      return res.status(404).json({ error: 'Remote host not found' });
    }

    const mgr = getConnection(req.params.id);
    if (!mgr || !mgr.isReady) {
      return res.status(409).json({ error: 'Host is not connected' });
    }

    const dirPath = req.query.path || '/';

    const result = await mgr.transport.request('fs/readdir', { path: dirPath, maxDepth: 1 });

    // Filter to directories only
    const entries = Array.isArray(result)
      ? result.filter((entry) => entry.type === 'directory')
      : [];

    return res.status(200).json({
      path: dirPath,
      entries: entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type,
      })),
    });
  } catch (err) {
    console.error('[remote-connections] GET /:id/browse error:', err);
    return res.status(500).json({ error: 'Failed to browse remote filesystem', details: err.message });
  }
});

// POST /:id/add-project — Register a remote project
router.post('/:id/add-project', async (req, res) => {
  try {
    const host = remoteHostsDb.getById(req.params.id);
    if (!host) {
      return res.status(404).json({ error: 'Remote host not found' });
    }

    const { remotePath } = req.body || {};
    if (!remotePath || typeof remotePath !== 'string') {
      return res.status(400).json({ error: 'remotePath is required and must be a non-empty string' });
    }

    const projectName = `remote:${req.params.id}:${Buffer.from(remotePath).toString('base64')}`;
    const displayName = remotePath.split('/').filter(Boolean).pop() || remotePath;

    const config = await loadProjectConfig();

    // Return existing if already registered
    if (config[projectName]) {
      return res.status(200).json({
        success: true,
        project: { name: projectName, displayName, remotePath, hostId: req.params.id },
        existing: true,
      });
    }

    config[projectName] = {
      manuallyAdded: true,
      originalPath: remotePath,
      isRemote: true,
      hostId: req.params.id,
    };

    if (displayName) {
      config[projectName].displayName = displayName;
    }

    await saveProjectConfig(config);

    return res.status(201).json({
      success: true,
      project: { name: projectName, displayName, remotePath, hostId: req.params.id },
    });
  } catch (err) {
    console.error('[remote-connections] POST /:id/add-project error:', err);
    return res.status(500).json({ error: 'Failed to add remote project', details: err.message });
  }
});

  return router;
}
