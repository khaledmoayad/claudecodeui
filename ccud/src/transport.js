/**
 * @module ccud/transport
 * Stdin/stdout JSON-RPC transport with newline framing.
 * Uses jsonrpc-lite for message validation.
 */
import { createInterface } from 'readline';
import jsonrpc from 'jsonrpc-lite';
import { log, error as logError } from './logger.js';

export function createStdioTransport(onMessage) {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      // Use jsonrpc-lite to validate and classify the message
      if (Array.isArray(parsed)) {
        // Batch request -- pass array of parsed objects
        onMessage(parsed);
      } else {
        const rpcObj = jsonrpc.parseObject(parsed);
        onMessage(parsed, rpcObj);
      }
    } catch (e) {
      logError(`Invalid JSON-RPC: ${e.message}`);
    }
  });

  // CRITICAL: stdin close = SSH disconnected = self-terminate
  rl.on('close', () => {
    log('stdin closed, shutting down');
    // Grace period for pending operations
    setTimeout(() => process.exit(0), 5000);
  });

  return {
    send(msg) {
      process.stdout.write(JSON.stringify(msg) + '\n');
    },
  };
}
