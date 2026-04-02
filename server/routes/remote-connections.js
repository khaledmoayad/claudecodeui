/** @module routes/remote-connections */

import express from 'express';
import { createConnection, getConnection, removeConnection, getAllConnections } from '../remote/connection-manager.js';
import { remoteHostsDb } from '../remote/remote-hosts-db.js';

const router = express.Router();

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

export default router;
