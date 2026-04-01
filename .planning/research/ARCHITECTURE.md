# Architecture Patterns

**Domain:** SSH remote development system (daemon + connection layer + operation abstraction)
**Researched:** 2026-04-01

## Recommended Architecture

The system adds three new layers to the existing monolith: a **remote daemon** (`ccud`) that runs on target hosts, an **SSH connection manager** on the server, and a **ProjectOperations abstraction** that lets existing routes work transparently with both local and remote projects.

### High-Level Topology

```
Browser (React SPA)
  |
  | WebSocket / REST (unchanged)
  |
Express Server (port 3001)
  |
  +-- ProjectOperations interface
  |     |
  |     +-- LocalOperations (fs, child_process, node-pty)  [existing behavior]
  |     |
  |     +-- RemoteOperations (JSON-RPC proxy over SSH)
  |           |
  |           | SSH tunnel (ssh2 channel -> stdin/stdout)
  |           |
  |           ccud daemon (on remote host)
  |             +-- fs operations (readFile, writeFile, readdir, stat, ...)
  |             +-- git operations (status, diff, log, commit, ...)
  |             +-- PTY management (node-pty spawn, resize, data relay)
  |             +-- file watching (chokidar -> JSON-RPC notifications)
  |             +-- Claude CLI spawning (session management, streaming)
```

### Component Boundaries

| Component | Responsibility | Location | Communicates With |
|-----------|---------------|----------|-------------------|
| **ProjectOperations** | Interface defining all project I/O operations (files, git, shell, watch) | `server/operations/types.js` | Routes, WebSocket handlers |
| **LocalOperations** | Implements ProjectOperations using direct fs/child_process/node-pty calls | `server/operations/local.js` | Local filesystem, local processes |
| **RemoteOperations** | Implements ProjectOperations by proxying calls over JSON-RPC to ccud | `server/operations/remote.js` | SSHConnectionManager |
| **SSHConnectionManager** | Manages ssh2 connections, lifecycle, reconnection, connection pooling per host | `server/ssh/connection-manager.js` | ssh2 library, RemoteOperations |
| **SSHTransport** | Wraps a single ssh2 channel as a JSON-RPC transport (framing, send, receive) | `server/ssh/transport.js` | SSHConnectionManager |
| **ccud daemon** | JSON-RPC server running on remote host, runs actual operations | `daemon/` (separate directory, SCP-deployed) | Local filesystem on remote host, node-pty, chokidar, Claude CLI |
| **DaemonDeployer** | Handles SCP upload of ccud to remote hosts, version checking, auto-update | `server/ssh/deployer.js` | SSHConnectionManager, SFTP |
| **SSH Config Store** | SQLite table for SSH connection configs (host, port, user, key path) | `server/database/` | Routes (CRUD), SSHConnectionManager |

### Data Flow

**Remote file read (example):**

```
1. Frontend: GET /api/projects/:projectName/file?filePath=src/main.ts
2. Route handler: ops = getOperations(projectName) -> returns RemoteOperations
3. RemoteOperations.readFile('src/main.ts')
4. -> JSON-RPC request: {"jsonrpc":"2.0","id":42,"method":"fs.readFile","params":{"path":"src/main.ts"}}
5. -> Written to ssh2 channel stdin
6. ccud daemon receives on stdin, reads file from local disk
7. ccud writes response to stdout: {"jsonrpc":"2.0","id":42,"result":{"content":"...","encoding":"utf-8"}}
8. SSHTransport reads from ssh2 channel stdout, resolves pending Promise
9. RemoteOperations returns content to route handler
10. Route handler sends HTTP response (identical format to local)
```

**Remote shell/PTY (example):**

```
1. Frontend: WebSocket /shell -> sends {type:'init', projectPath:'/home/user/proj', ...}
2. handleShellConnection: ops = getOperations(projectName) -> RemoteOperations
3. RemoteOperations.createPty({cols, rows, cwd})
4. -> JSON-RPC request: {"method":"pty.create","params":{"cols":80,"rows":24,"cwd":"/home/user/proj"}}
5. ccud spawns node-pty process, assigns ptyId
6. ccud returns: {"result":{"ptyId":"abc123"}}
7. User types keystroke -> RemoteOperations.writePty("abc123", data)
8. -> JSON-RPC request: {"method":"pty.write","params":{"ptyId":"abc123","data":"ls\n"}}
9. ccud writes to PTY stdin
10. PTY output -> ccud sends JSON-RPC notification: {"method":"pty.data","params":{"ptyId":"abc123","data":"..."}}
11. SSHTransport receives notification -> RemoteOperations emits event -> WebSocket sends to frontend
```

**Remote file watching:**

```
1. On project open: RemoteOperations.watch('/home/user/proj')
2. -> JSON-RPC request: {"method":"fs.watch","params":{"path":"/home/user/proj"}}
3. ccud starts chokidar watcher on remote host
4. File changes -> ccud sends JSON-RPC notifications:
   {"method":"fs.changed","params":{"type":"change","path":"src/main.ts"}}
5. SSHTransport delivers notification to RemoteOperations
6. RemoteOperations emits event -> server broadcasts projects_updated WebSocket message
```

## Patterns to Follow

### Pattern 1: Strategy Pattern for ProjectOperations

The core abstraction. All existing routes call operations through this interface rather than directly using `fs`, `child_process`, or `node-pty`. The factory function resolves the right implementation based on project type.

**What:** Define a common interface, implement it twice (local + remote), select at runtime.
**When:** Every route or WebSocket handler that touches project files, git, or shell.
**Why:** This is the pattern the codebase already uses for AI providers (ProviderAdapter). Apply the same principle to project I/O.

```javascript
// server/operations/types.js - JSDoc interface (matches server convention: plain JS)

/**
 * @typedef {Object} ProjectOperations
 * @property {(filePath: string) => Promise<{content: string, encoding: string}>} readFile
 * @property {(filePath: string, content: string) => Promise<void>} writeFile
 * @property {(dirPath: string, opts?: {withFileTypes?: boolean}) => Promise<Array>} readdir
 * @property {(filePath: string) => Promise<{size: number, mtime: string, isDirectory: boolean}>} stat
 * @property {(dirPath: string) => Promise<void>} mkdir
 * @property {(oldPath: string, newPath: string) => Promise<void>} rename
 * @property {(filePath: string) => Promise<void>} unlink
 * @property {(opts: PtyOptions) => Promise<PtyHandle>} createPty
 * @property {(args: string[], opts: object) => Promise<{stdout: string, stderr: string}>} spawnCommand
 * @property {(path: string, callback: Function) => Watcher} watch
 * @property {() => void} dispose
 */

// server/operations/index.js - Factory
import { LocalOperations } from './local.js';
import { RemoteOperations } from './remote.js';
import { getProjectConfig } from '../database/db.js';

const operationsCache = new Map();

export function getOperations(projectName) {
  if (operationsCache.has(projectName)) {
    return operationsCache.get(projectName);
  }
  const config = getProjectConfig(projectName);
  const ops = config?.sshHost
    ? new RemoteOperations(config)
    : new LocalOperations(config.projectPath);
  operationsCache.set(projectName, ops);
  return ops;
}
```

**Confidence:** HIGH. This is a textbook Strategy/Proxy pattern. VS Code Remote uses this exact approach (local extensions vs remote extensions behind the same interface). The existing ProviderAdapter pattern in this codebase proves the team already understands this pattern.

### Pattern 2: JSON-RPC 2.0 Over Newline-Delimited Stdio

The daemon protocol. Use JSON-RPC 2.0 exactly as specified, with newline-delimited messages over stdio. This is the same transport MCP uses for local servers.

**What:** Each JSON-RPC message is a single line of JSON terminated by `\n`. No Content-Length headers. No embedded newlines in messages.
**When:** All communication between the Express server and the ccud daemon.
**Why:** Simpler than Content-Length framing (which VS Code's LSP implementation uses internally). MCP chose newline-delimited for stdio specifically because it is simpler to implement and debug. Content-Length framing adds complexity for no benefit when messages are always complete JSON objects.

```javascript
// daemon/transport.js - Message framing on daemon side
import { createInterface } from 'readline';

export function createStdioTransport(onMessage) {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      onMessage(msg);
    } catch (e) {
      // Log to stderr (never pollute stdout)
      console.error('Invalid JSON-RPC message:', e.message);
    }
  });

  return {
    send(msg) {
      const json = JSON.stringify(msg);
      process.stdout.write(json + '\n');
    },
    close() {
      rl.close();
    }
  };
}
```

```javascript
// server/ssh/transport.js - Message framing on server side
export class SSHTransport {
  constructor(sshStream) {
    this._stream = sshStream;
    this._pending = new Map(); // id -> {resolve, reject, timer}
    this._nextId = 1;
    this._handlers = new Map(); // method -> handler (for notifications)
    this._buffer = '';

    sshStream.stdout.on('data', (chunk) => {
      this._buffer += chunk.toString();
      this._processBuffer();
    });
  }

  _processBuffer() {
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop(); // Keep incomplete last line in buffer
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && this._pending.has(msg.id)) {
          // Response to our request
          const { resolve, reject, timer } = this._pending.get(msg.id);
          clearTimeout(timer);
          this._pending.delete(msg.id);
          msg.error ? reject(msg.error) : resolve(msg.result);
        } else if (msg.method && !msg.id) {
          // Notification from daemon
          const handler = this._handlers.get(msg.method);
          if (handler) handler(msg.params);
        }
      } catch (e) { /* log parse error */ }
    }
  }

  request(method, params, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);
      this._pending.set(id, { resolve, reject, timer });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      this._stream.write(msg);
    });
  }

  notify(method, params) {
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    this._stream.write(msg);
  }

  onNotification(method, handler) {
    this._handlers.set(method, handler);
  }
}
```

**Confidence:** HIGH. MCP specification (2025-06-18) mandates this exact format for stdio transport: "Messages are delimited by newlines, and MUST NOT contain embedded newlines." This is proven at massive scale across the entire MCP ecosystem.

### Pattern 3: SSH Channel for Daemon Stdio (Not TCP Port Forwarding)

Use `ssh2.Client` to launch the daemon as a remote process, then pipe JSON-RPC over the channel's stdin/stdout. Do NOT use TCP port forwarding.

**What:** The server calls `conn.exec('node ~/.ccud/daemon.js')` which returns a duplex stream. The writable side is the daemon's stdin; the readable side is the daemon's stdout.
**When:** When establishing a connection to a remote project.
**Why:** Port forwarding requires finding a free port on the remote host, opening it, and dealing with firewall rules. Channel-based stdio avoids all of that. SSH handles encryption and authentication. This is the same approach VS Code Remote and MCP use.

```javascript
// server/ssh/connection-manager.js (simplified)
import { Client } from 'ssh2';

export class SSHConnectionManager {
  constructor() {
    this._connections = new Map(); // hostKey -> { client, transport, refCount }
  }

  async connect(config) {
    const key = `${config.user}@${config.host}:${config.port}`;
    if (this._connections.has(key)) {
      const conn = this._connections.get(key);
      conn.refCount++;
      return conn.transport;
    }

    const client = new Client();
    await new Promise((resolve, reject) => {
      client.on('ready', resolve);
      client.on('error', reject);
      client.connect({
        host: config.host,
        port: config.port || 22,
        username: config.user,
        privateKey: config.privateKey,
        keepaliveInterval: 15000,  // 15s keepalive
        keepaliveCountMax: 3,      // disconnect after 3 missed
        readyTimeout: 20000,       // 20s handshake timeout
      });
    });

    // Launch daemon via the SSH channel
    const stream = await new Promise((resolve, reject) => {
      client.exec('node ~/.ccud/daemon.js', (err, stream) => {
        if (err) reject(err);
        else resolve(stream);
      });
    });

    const transport = new SSHTransport(stream);
    this._connections.set(key, { client, transport, stream, refCount: 1 });

    // Handle unexpected disconnect
    client.on('close', () => this._handleDisconnect(key));
    client.on('error', (err) => this._handleError(key, err));

    return transport;
  }
}
```

**Confidence:** HIGH. The ssh2 library's channel API is well-documented and widely used. The readable side of the stream is stdout, the writable side is stdin. This is the standard pattern for launching and communicating with remote processes over SSH.

### Pattern 4: Connection Lifecycle State Machine

Manage each SSH connection through explicit states with clear transitions and automatic reconnection.

**What:** Each connection has states: `disconnected` -> `connecting` -> `deploying` (daemon install) -> `initializing` (JSON-RPC handshake) -> `ready` -> `disconnected`. Reconnection attempts use exponential backoff.
**When:** Connection establishment, keepalive failure, network interruption.

```
States and transitions:

  DISCONNECTED
       |
       v (connect requested)
  CONNECTING -----> ERROR (auth fail, timeout)
       |                |
       v (SSH ready)    v (after max retries)
  DEPLOYING ------> FAILED
       |
       v (daemon running)
  INITIALIZING
       |
       v (JSON-RPC handshake OK)
  READY ----------> RECONNECTING (on keepalive timeout / stream close)
                         |
                         v (backoff: 1s, 2s, 4s, 8s, max 30s)
                    CONNECTING (retry)
```

**Why:** VS Code Remote SSH has notorious reconnection issues (Issues #10987, #7497, #8227 on microsoft/vscode-remote-release). Many stem from unclear state management during reconnection. An explicit state machine prevents stuck-in-reconnecting bugs. The ssh2 library's `keepaliveInterval` and `keepaliveCountMax` options detect dead connections, but the reconnection logic must be in our code.

**Confidence:** MEDIUM. The state machine pattern itself is well-established. The specific states and transitions are our design based on analyzing VS Code Remote's failure modes. The exponential backoff values (1s-30s) are standard practice but may need tuning.

### Pattern 5: Daemon Capability Handshake

On connection, the daemon and server exchange capabilities (protocol version, supported methods, daemon version). This prevents version mismatch bugs when the daemon is auto-deployed.

**What:** After the SSH channel is established, the server sends an `initialize` request and the daemon responds with its capabilities.
**When:** Immediately after daemon process starts (before any operational requests).

```javascript
// Handshake sequence:
// Server -> Daemon:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "1.0",
    "clientVersion": "1.27.1"
  }
}

// Daemon -> Server:
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "1.0",
    "daemonVersion": "1.0.0",
    "capabilities": {
      "fs": true,
      "git": true,
      "pty": true,
      "watch": true,
      "claude": true
    },
    "platform": "linux",
    "nodeVersion": "22.0.0"
  }
}
```

**Why:** MCP does this (see the `initialize` / `notifications/initialized` sequence in the specification). Without it, a version-mismatched daemon silently fails on methods it doesn't support. Auto-deployment makes version mismatches a real risk.

**Confidence:** HIGH. Direct adaptation of MCP's initialization protocol, which is proven in production.

### Pattern 6: Multiplexed PTY Sessions Over Single Connection

A single SSH connection (and single daemon process) handles multiple concurrent PTY sessions, file operations, and git commands. Each PTY gets a unique ID; data is multiplexed through JSON-RPC notifications.

**What:** The daemon maintains a `Map<ptyId, PtyProcess>`. PTY output is sent as notifications with the ptyId. The server-side RemoteOperations demultiplexes by ptyId and routes to the correct WebSocket.
**When:** Users open multiple terminals or have concurrent operations on the same remote host.

```javascript
// Daemon-side PTY management
const ptySessions = new Map();

handlers.set('pty.create', async (params) => {
  const ptyId = crypto.randomUUID();
  const proc = pty.spawn(params.shell || 'bash', [], {
    cols: params.cols || 80,
    rows: params.rows || 24,
    cwd: params.cwd,
    env: process.env,
  });

  proc.onData((data) => {
    transport.notify('pty.data', { ptyId, data });
  });

  proc.onExit(({ exitCode }) => {
    transport.notify('pty.exit', { ptyId, exitCode });
    ptySessions.delete(ptyId);
  });

  ptySessions.set(ptyId, proc);
  return { ptyId };
});

handlers.set('pty.write', async ({ ptyId, data }) => {
  const proc = ptySessions.get(ptyId);
  if (!proc) throw { code: -32001, message: 'PTY not found' };
  proc.write(data);
});

handlers.set('pty.resize', async ({ ptyId, cols, rows }) => {
  const proc = ptySessions.get(ptyId);
  if (!proc) throw { code: -32001, message: 'PTY not found' };
  proc.resize(cols, rows);
});
```

**Why:** Opening a separate SSH connection per terminal or per file operation would be wasteful and hit SSH connection limits. VS Code Remote multiplexes everything over a single SSH tunnel. The JSON-RPC notification mechanism (no `id` field = one-way) is perfect for streaming PTY output because it doesn't expect a response.

**Confidence:** HIGH. This is the standard approach. JSON-RPC 2.0 explicitly supports concurrent in-flight requests (each with unique `id`) and unidirectional notifications.

## Anti-Patterns to Avoid

### Anti-Pattern 1: TCP Port Forwarding for Daemon Communication
**What:** Using SSH port forwarding or `-L` tunnels to expose a TCP port on the remote host, then connecting to it.
**Why bad:** Requires finding free ports, managing port conflicts, opening firewall rules, and adds unnecessary complexity. If the port is exposed, it's an attack surface.
**Instead:** Use SSH channel stdio. SSH provides the encrypted transport; the daemon reads stdin and writes stdout. Zero port management.

### Anti-Pattern 2: One SSH Connection Per Operation
**What:** Opening a new SSH connection for each file read, git status, etc.
**Why bad:** SSH handshake is expensive (100-500ms). Under rapid operations (file tree browsing, git status + diff), this creates unacceptable latency and may exhaust connection limits (`MaxSessions` in sshd).
**Instead:** One persistent SSH connection per host, multiplexed through the daemon. Connection pooling with refcounting for cleanup.

### Anti-Pattern 3: Content-Length Framing for Stdio
**What:** Using HTTP-style `Content-Length: N\r\n\r\n{json}` framing (like VS Code's LSP implementation uses internally).
**Why bad:** Adds implementation complexity. Requires exact byte counting (careful with UTF-8 multi-byte characters). Newline-delimited JSON is simpler and is the MCP standard for stdio.
**Instead:** Newline-delimited JSON. Each message is one line terminated by `\n`. Trivially parseable with Node's `readline` module.

### Anti-Pattern 4: Modifying Existing Route Handlers Directly
**What:** Adding `if (isRemote) { ... } else { ... }` branches inside every existing route handler.
**Why bad:** Violates Open/Closed Principle. Makes every existing handler more complex. Creates bugs when new routes forget the branch. Makes testing harder.
**Instead:** The ProjectOperations abstraction. Routes call `ops.readFile()` / `ops.spawnCommand()` without knowing whether it's local or remote. The factory resolves the implementation. Existing handlers change only once: to get their `ops` from the factory instead of calling `fs` directly.

### Anti-Pattern 5: Daemon Stores State Without Client Knowledge
**What:** The daemon creates file watchers, PTY sessions, or caches without the server explicitly requesting them.
**Why bad:** If the SSH connection drops and reconnects, the server has no way to know what the daemon was doing. State becomes inconsistent.
**Instead:** Server-driven. All watchers and PTY sessions are created by explicit JSON-RPC requests from the server. On reconnection, the server re-establishes the watchers and PTY sessions it needs (or the daemon can be restarted fresh).

## Scalability Considerations

| Concern | 1-2 remote hosts | 5-10 remote hosts | 20+ remote hosts |
|---------|-------------------|--------------------|--------------------|
| SSH connections | One per host. ~5KB memory each. Negligible. | 5-10 persistent connections. ssh2 handles fine. | May need connection lazy-loading (connect on project open, disconnect after idle timeout). |
| Daemon memory | ~30-50MB per daemon (Node.js baseline + chokidar + node-pty). Fine. | One daemon per host regardless of project count on that host. Fine. | Same; daemon is per-host not per-project. |
| JSON-RPC throughput | No concern. File reads are <10 req/s typically. | PTY output can be high (e.g., `cat large_file`). Stdout buffering handles this. | May need flow control for PTY data. Consider a `pty.pause` / `pty.resume` mechanism if backpressure becomes an issue. |
| Reconnection storms | Single host: one reconnect attempt. | If network blip affects all hosts simultaneously, 5-10 concurrent reconnection attempts. Use per-host independent backoff. | Stagger reconnections. Add jitter to backoff (e.g., random 0-2s added to each backoff step). |

## Suggested Build Order

Based on dependency analysis, build in this order:

### Layer 1: Foundation (no dependencies on other new code)
1. **SSH Config Store** (database schema + CRUD routes) - Needed by everything else. Small, well-bounded.
2. **ProjectOperations type definitions** (`types.js`) - The interface contract everything implements.
3. **LocalOperations implementation** - Wraps existing `fs`/`child_process` calls behind the new interface. Proves the interface is correct.

### Layer 2: Transport (depends on Layer 1)
4. **ccud daemon skeleton** - JSON-RPC server over stdio with `initialize` handshake. Start with just `fs.readFile` and `fs.stat` to prove the protocol works.
5. **SSHTransport** - JSON-RPC client over ssh2 channel stream. Newline-delimited framing, request/response correlation, notification handling.
6. **SSHConnectionManager** - Connection lifecycle, keepalive, reconnection state machine.

### Layer 3: Operations (depends on Layer 2)
7. **RemoteOperations** - Implements ProjectOperations by delegating to SSHTransport. Start with file operations.
8. **DaemonDeployer** - SCP upload of daemon, version checking.
9. **Route migration** - Refactor existing routes to use `getOperations()` instead of direct `fs` calls.

### Layer 4: Advanced features (depends on Layer 3)
10. **Remote PTY** - `pty.create` / `pty.write` / `pty.data` notification multiplexing.
11. **Remote file watching** - `fs.watch` request + `fs.changed` notifications.
12. **Remote git operations** - Git commands run via daemon's `spawnCommand`.
13. **Remote Claude CLI** - Session spawning and streaming over JSON-RPC.

### Layer 5: UX (depends on Layer 4)
14. **Connection status UI** - Frontend indicator showing connection state per project.
15. **Add Remote Project wizard** - SSH config form, connection test, daemon deploy.
16. **Auto-reconnection UX** - Reconnecting banner, buffered operations during reconnect.

**Rationale for this order:**
- Layer 1 can be built and tested without any SSH infrastructure.
- Layer 2 can be tested locally by spawning the daemon as a child process (same stdio transport, no SSH needed).
- Layer 3 is the integration point where SSH + daemon + routes converge.
- Layer 4 adds streaming/notification features that are harder to debug, so they come after the request/response foundation is solid.
- Layer 5 is pure UI that depends on the backend being functional.

## Sources

- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) - HIGH confidence. Official specification for JSON-RPC over stdio patterns.
- [MCP Transport Specification (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) - HIGH confidence. Authoritative source for stdio message framing: "Messages are delimited by newlines, and MUST NOT contain embedded newlines."
- [VS Code Remote SSH Documentation](https://code.visualstudio.com/docs/remote/ssh) - HIGH confidence. Architectural inspiration for client-server over SSH.
- [VS Code Remote SSH DeepWiki Analysis](https://deepwiki.com/microsoft/vscode-remote-release/3.1-remote-ssh) - MEDIUM confidence. Third-party analysis of VS Code Remote architecture.
- [ssh2 npm package](https://github.com/mscdex/ssh2) - HIGH confidence. Official documentation for channel API, connection options (keepaliveInterval, keepaliveCountMax, readyTimeout).
- [vscode-jsonrpc](https://github.com/microsoft/vscode-languageserver-node/blob/main/jsonrpc/README.md) - HIGH confidence. VS Code's JSON-RPC implementation using StreamMessageReader/Writer over stdio.
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification) - HIGH confidence. Protocol standard for requests, responses, notifications.
- [VS Code Remote SSH reconnection issues](https://github.com/microsoft/vscode-remote-release/issues/10987) - MEDIUM confidence. Real-world failure modes informing our state machine design.
- [Proxy Design Pattern](https://refactoring.guru/design-patterns/proxy) - HIGH confidence. Foundational pattern for local/remote abstraction.
- [ssh2-promise](https://github.com/sanketbajoria/ssh2-promise) - MEDIUM confidence. Reference for reconnection patterns with ssh2.

---

*Architecture research: 2026-04-01*
