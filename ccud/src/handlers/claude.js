/**
 * @module ccud/handlers/claude
 * Claude CLI session management handler for claude/* RPC methods.
 * Spawns the claude CLI as a child process with --output-format stream-json,
 * relays structured output as JSON-RPC notifications via the transport.
 */
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

/** @type {Map<string, { process: import('child_process').ChildProcess, cwd: string }>} */
const activeSessions = new Map();

/**
 * Check if the claude CLI is available on the system PATH.
 * @returns {Promise<boolean>}
 */
async function isClaudeAvailable() {
  try {
    await execFileAsync('command', ['-v', 'claude'], { shell: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Handle all claude/* JSON-RPC methods.
 *
 * Supported methods:
 * - claude/start: Start a Claude CLI session (spawns child process)
 * - claude/input: Send text input to a running session's stdin
 * - claude/abort: Kill a running session
 * - claude/list-sessions: List existing Claude sessions in a directory
 *
 * @param {string} method - The RPC method name (e.g., 'claude/start')
 * @param {object} params - Method parameters
 * @param {object} transport - The stdio transport for sending notifications
 * @returns {Promise<object>} Result object or error object with { error: { code, message } }
 */
export async function handleClaude(method, params, transport) {
  switch (method) {
    case 'claude/start': {
      const available = await isClaudeAvailable();
      if (!available) {
        return {
          error: {
            code: -32000,
            message: 'Claude Code CLI not found on remote host. Install it with: npm install -g @anthropic-ai/claude-code',
          },
        };
      }

      const sessionId = params.sessionId || crypto.randomUUID();

      const args = ['--output-format', 'stream-json', '--verbose'];
      if (params.sessionId) {
        args.push('--resume', params.sessionId);
      }
      if (params.options?.model) {
        args.push('--model', params.options.model);
      }
      if (params.options?.permissionMode) {
        args.push('--permission-mode', params.options.permissionMode);
      }
      if (params.command) {
        args.push('-p', params.command);
      }

      let proc;
      try {
        proc = spawn('claude', args, {
          cwd: params.cwd,
          env: { ...process.env, TERM: 'dumb' },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        return {
          error: {
            code: -32000,
            message: 'Failed to spawn Claude CLI: ' + err.message,
          },
        };
      }

      activeSessions.set(sessionId, { process: proc, cwd: params.cwd });

      // Accumulate response text from assistant/message events so we can
      // include it in the exit notification as a fallback. This protects
      // against notifications being lost when the stdout pipe is congested
      // by large concurrent responses (e.g., fs/readdir).
      let accumulatedText = '';

      // Parse stdout as newline-delimited JSON (stream-json format)
      let buffer = '';
      proc.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete last line
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            // Capture text from assistant/message events
            if ((event.type === 'assistant' || event.type === 'message') && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'text' && block.text) {
                  accumulatedText += block.text;
                }
              }
            }
            // Also capture from result event if present
            if (event.type === 'result' && typeof event.result === 'string') {
              if (!accumulatedText) accumulatedText = event.result;
            }

            transport.send({
              jsonrpc: '2.0',
              method: 'claude/output',
              params: { sessionId, event },
            });
          } catch {
            // Non-JSON output -- send as raw text
            transport.send({
              jsonrpc: '2.0',
              method: 'claude/output',
              params: { sessionId, event: { type: 'raw', text: line } },
            });
          }
        }
      });

      // Relay stderr as notifications
      proc.stderr.on('data', (chunk) => {
        const text = chunk.toString().trim();
        if (text) {
          transport.send({
            jsonrpc: '2.0',
            method: 'claude/output',
            params: { sessionId, event: { type: 'stderr', text } },
          });
        }
      });

      // Handle process exit — include accumulated text as fallback
      proc.on('exit', (code, signal) => {
        activeSessions.delete(sessionId);
        transport.send({
          jsonrpc: '2.0',
          method: 'claude/output',
          params: { sessionId, event: { type: 'exit', code, signal, accumulatedText: accumulatedText || null } },
        });
      });

      // Handle spawn errors (ENOENT, EACCES, etc.)
      proc.on('error', (err) => {
        activeSessions.delete(sessionId);
        transport.send({
          jsonrpc: '2.0',
          method: 'claude/output',
          params: { sessionId, event: { type: 'exit', code: 1, signal: null, error: err.message } },
        });
      });

      return { sessionId, started: true };
    }

    case 'claude/input': {
      const session = activeSessions.get(params.sessionId);
      if (!session) {
        return { error: { code: -32000, message: 'Session not found' } };
      }
      try {
        session.process.stdin.write(params.text + '\n');
      } catch (err) {
        return { error: { code: -32000, message: 'Failed to write to stdin: ' + err.message } };
      }
      return { sent: true };
    }

    case 'claude/abort': {
      const session = activeSessions.get(params.sessionId);
      if (session) {
        session.process.kill('SIGTERM');
        // Fallback to SIGKILL after 5 seconds
        const killTimer = setTimeout(() => {
          try {
            session.process.kill('SIGKILL');
          } catch {
            // Process may already be dead
          }
        }, 5000);
        session.process.on('exit', () => clearTimeout(killTimer));
        activeSessions.delete(params.sessionId);
      }
      return { aborted: true };
    }

    case 'claude/list-sessions': {
      try {
        const { stdout } = await execFileAsync(
          'claude',
          ['--output-format', 'json', 'sessions', 'list'],
          { cwd: params.cwd, timeout: 15000 },
        );
        const sessions = JSON.parse(stdout);
        return { sessions: Array.isArray(sessions) ? sessions : [] };
      } catch {
        return { sessions: [], error: 'Failed to list sessions' };
      }
    }

    default:
      return { error: { code: -32601, message: 'Method not found: ' + method } };
  }
}

/**
 * Kill all active Claude sessions and clear the session map.
 * Called during daemon shutdown to release resources.
 */
export function cleanupAllClaudeSessions() {
  for (const [sessionId, session] of activeSessions) {
    try {
      session.process.kill('SIGTERM');
    } catch {
      // Process may already be dead
    }
    activeSessions.delete(sessionId);
  }
}
