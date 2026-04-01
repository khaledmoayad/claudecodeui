# Technology Stack

**Project:** Remote SSH Project Support for Claude Code UI
**Researched:** 2026-04-01
**Mode:** Ecosystem (subsequent milestone -- SSH remote development tooling in Node.js)

## Recommended Stack

### SSH Library

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `ssh2` | `^1.17.0` | SSH client (connections, exec, shell, SFTP) | Pure JS, no native deps, 1900+ dependents, battle-tested. The de facto Node.js SSH library. Provides everything needed: PTY-capable shell/exec, SFTP for daemon deployment, stream-based stdin/stdout for JSON-RPC transport. | HIGH |

**Why `ssh2` over `node-ssh`:** The project needs low-level control over SSH channels -- PTY allocation, stdin/stdout stream piping for JSON-RPC, SFTP for daemon deployment, and keepalive management. `node-ssh` (v13.2.1) is a convenience wrapper over `ssh2` that abstracts away the stream control we specifically need. It also brings 5 extra dependencies (`is-stream`, `make-dir`, `sb-promise-queue`, `sb-scandir`, `shell-escape`) for no benefit in this use case. Use `ssh2` directly.

**Key `ssh2` capabilities we need:**
- `client.exec(cmd, { pty: false })` -- Launch daemon process with stdin/stdout for JSON-RPC
- `client.shell({ rows, cols, term })` -- PTY-allocated interactive shell for remote terminal
- `client.sftp()` -- File transfer for daemon deployment and updates
- `keepaliveInterval` / `keepaliveCountMax` -- Connection health monitoring
- Stream-based channels that implement Node.js Duplex -- pipe JSON-RPC messages directly

**Version note:** v1.17.0 is the latest as of research date, published mid-2025. Pure JS with optional native crypto acceleration (`cpu-features` and `nan` as optional deps). Only 2 runtime dependencies: `asn1` and `bcrypt-pbkdf`.

### JSON-RPC Protocol

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `jsonrpc-lite` | `^2.2.0` | JSON-RPC 2.0 message parsing/serialization | Zero dependencies. Parse-only -- does not impose transport opinions. We write our own transport over ssh2 stdio streams. Lightweight (just message construction and parsing). | HIGH |

**Why `jsonrpc-lite` over `json-rpc-2.0`:** We do NOT want a client/server framework. We want a message codec. Here is why:

- The JSON-RPC transport in this project is SSH stdio, which is an unusual transport. Libraries like `json-rpc-2.0` (v1.7.1) assume you provide a `send` function and handle request/response matching internally. This works for simple RPC but becomes awkward when you need server-initiated notifications (file watch events), bidirectional requests, and multiplexed channels.
- `jsonrpc-lite` is a pure parser/serializer: `JsonRpc.request(id, method, params)` builds an object, `JsonRpc.parse(message)` returns the parsed type (request/notification/success/error). You handle framing, routing, and correlation yourself.
- This matches the MCP stdio transport pattern exactly: newline-delimited JSON messages on stdin/stdout, with application-level routing. MCP proved this pattern works well for daemon-over-stdio communication.
- `jsonrpc-lite` has zero dependencies and is 2.2.0 stable (no changes needed in 5 years because it is feature-complete -- it just parses JSON-RPC).

**Why not Jayson:** Jayson v4.3.0 brings 12 runtime dependencies including `ws`, `commander`, `uuid`, and `stream-json`. It is a full-featured server framework designed for HTTP/WebSocket/TCP -- massive overkill for stdio message parsing.

**Framing protocol (custom, minimal):**
Follow the MCP stdio transport spec pattern:
- Messages are newline-delimited JSON (`\n` separator)
- Each line is a complete JSON-RPC 2.0 message
- Messages MUST NOT contain embedded newlines (JSON.stringify handles this)
- UTF-8 encoding throughout
- stderr reserved for daemon logging (not protocol messages)

This is simpler than LSP's `Content-Length` header framing and proven at scale by MCP.

### Daemon File Watching (remote side)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `chokidar` | `^4.0.3` | File watching on the remote daemon | Already used in the main server. Same API, same behavior. The daemon runs on the remote host natively, so chokidar uses inotify/FSEvents locally on that machine -- no remote polling needed. | HIGH |

**Critical insight:** File watching does NOT happen over SSH. Chokidar runs *on the remote daemon* watching the local filesystem there. When changes are detected, the daemon sends JSON-RPC notifications back over the SSH stdio channel. This is the same pattern VS Code Remote uses -- the daemon is a native process on the remote host.

**Why `^4.0.3` not `^5.0.0`:** The main project already uses chokidar `^4.0.3`. Using the same major version in the daemon avoids behavior differences. Chokidar 5.0.0 requires Node >= 20.19.0 and is ESM-only. While the daemon will target Node 20+, matching the main project's version reduces risk.

**Version decision:** If the daemon is bundled (see Infrastructure below), the chokidar version in the bundle is independent. Use `^4.0.3` to match the main project's tested behavior. Upgrade to v5 only if there is a specific reason.

### Daemon Bundling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `esbuild` | `^0.27.4` | Bundle daemon into single deployable JS file | Fastest bundler, perfect for build tooling. Bundles all daemon deps (jsonrpc-lite, chokidar, readdirp) into one file. No native deps in the daemon, so bundling is clean. | HIGH |

**Deployment pattern:**
1. At build time: `esbuild --bundle --platform=node --target=node20 --format=esm --outfile=dist/ccud.mjs daemon/index.js`
2. Produces a single `ccud.mjs` file (~50-100KB estimated, all deps inlined)
3. At deploy time: SFTP `ccud.mjs` to `~/.ccud/ccud.mjs` on remote host
4. Launch: `node ~/.ccud/ccud.mjs` via ssh2 exec

**Why esbuild over alternatives:**
- The project already uses Vite 7 (which uses esbuild internally for transforms), so the tooling concept is familiar
- Sub-second builds
- `--platform=node` correctly handles node built-ins (fs, path, etc.)
- No native modules in the daemon means clean bundling (chokidar v4 is pure JS on Linux)

**Why NOT Node.js SEA (Single Executable Application):** SEA embeds the Node.js runtime into a binary (~50MB+). Overkill -- the remote host already has Node.js installed (required for Claude Code CLI anyway). A single `.mjs` file deployed via SFTP is simpler, smaller, and easier to version/update.

### Remote PTY

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `ssh2` shell channel | (part of ssh2) | Remote terminal sessions | ssh2's `client.shell()` allocates a PTY on the remote host natively. No need for node-pty on the remote side -- the SSH protocol handles PTY allocation. | HIGH |

**How remote PTY works (no new dependencies needed):**

The existing local terminal flow is:
```
Browser xterm.js <-> WebSocket <-> server node-pty.spawn() <-> local shell
```

The remote terminal flow becomes:
```
Browser xterm.js <-> WebSocket <-> server ssh2.shell({rows, cols}) <-> remote shell (PTY allocated by sshd)
```

Key details:
- `ssh2` `client.shell({ rows: N, cols: M, term: 'xterm-256color' })` requests PTY allocation from the remote sshd
- The returned Channel is a Duplex stream -- pipe it like you would a node-pty stream
- Window resize: `channel.setWindow(rows, cols, height, width)` -- same as node-pty's `resize()`
- No node-pty needed on the remote daemon -- sshd handles PTY natively
- The daemon itself does NOT need to handle PTY for the terminal feature; SSH does this directly

**For daemon-spawned processes (Claude CLI on remote):**
The daemon uses the host's installed `node-pty` to spawn Claude CLI with PTY. But for the initial terminal feature, ssh2 shell channels are sufficient and much simpler.

### Database (connection config storage)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `better-sqlite3` | (existing) | Store SSH connection configs | Already the project's database. Add a `remote_hosts` table. No new dependency. | HIGH |

**Schema addition (not a stack decision, but informs it):**
```sql
CREATE TABLE remote_hosts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 22,
  username TEXT NOT NULL,
  private_key_path TEXT NOT NULL,
  daemon_version TEXT,
  last_connected_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

No new database dependencies. The existing `better-sqlite3` handles this.

## Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `ssh2` | `^1.17.0` | SSH connections, SFTP, shell channels | Every remote operation | HIGH |
| `jsonrpc-lite` | `^2.2.0` | JSON-RPC 2.0 message codec | Daemon protocol messages | HIGH |
| `esbuild` | `^0.27.4` (dev) | Bundle daemon for deployment | Build step only | HIGH |
| `chokidar` | `^4.0.3` | File watching in daemon | Bundled into daemon | HIGH |

**Total new runtime dependencies: 2** (`ssh2`, `jsonrpc-lite`)
**Total new dev dependencies: 1** (`esbuild`)
**Daemon-bundled (not installed on UI server): 2** (`jsonrpc-lite`, `chokidar` -- both bundled into ccud.mjs)

Net new `node_modules` additions to the UI server: `ssh2` (+ its 2 deps: `asn1`, `bcrypt-pbkdf`). That is it.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| SSH | `ssh2` | `node-ssh` v13 | Wraps ssh2 with 5 extra deps. Hides stream control we need for JSON-RPC transport and PTY management. |
| SSH | `ssh2` | `ssh2-promise` | Abandoned (last publish 4+ years ago). Thin promise wrapper adds no value over our own async helpers. |
| JSON-RPC | `jsonrpc-lite` | `json-rpc-2.0` v1.7.1 | Framework-style API with `send` function injection. Awkward for bidirectional stdio with server-push notifications. We need a codec, not a framework. |
| JSON-RPC | `jsonrpc-lite` | `jayson` v4.3.0 | 12 runtime dependencies. Full server framework (HTTP, WS, TCP). Absurd overkill for stdio message parsing. |
| JSON-RPC | `jsonrpc-lite` | Hand-rolled | JSON-RPC 2.0 is simple but has edge cases (batch requests, error codes, notification vs request distinction). A tested parser avoids bugs. |
| JSON-RPC | `jsonrpc-lite` | `@modelcontextprotocol/sdk` | Would work (same stdio JSON-RPC pattern), but brings the entire MCP protocol stack. We only need the message format, not MCP semantics. |
| Bundler | `esbuild` | `rollup` | Slower, more config needed. esbuild's `--platform=node` just works for pure-JS Node.js bundles. |
| Bundler | `esbuild` | `webpack` | Extremely slow for this use case. Configuration-heavy. |
| Bundler | `esbuild` | No bundling (npm install on remote) | Requires npm on remote, network access from remote, and managing node_modules. SFTP of a single file is dramatically simpler and faster. |
| Deployment | SFTP via ssh2 | `node-scp` | Wraps ssh2 SFTP with unnecessary abstraction. We already have an ssh2 connection -- just use `sftp.fastPut()` directly. |
| Remote PTY | ssh2 shell channel | node-pty on remote via daemon | Unnecessary complexity. SSH protocol handles PTY allocation natively. The daemon does not need to be involved in terminal sessions. |
| File watching | chokidar on daemon | SFTP polling from UI server | Polling is slow, bandwidth-wasteful, and misses rapid changes. Native inotify on the remote host via chokidar in the daemon is the correct pattern. |
| File watching | chokidar v4 | `fs.watch` (Node.js built-in) | Node.js `fs.watch` has known issues: missing events on some platforms, no recursive watching on Linux (until Node 20), no glob support. Chokidar normalizes all of this. |

## Installation

```bash
# Runtime dependency (UI server)
npm install ssh2

# Dev dependency (daemon bundling)
npm install -D esbuild

# Daemon dependencies (installed in daemon/ subdirectory, bundled by esbuild)
# These are NOT installed in the main project's node_modules
cd daemon/
npm init -y
npm install jsonrpc-lite chokidar@^4.0.3
```

Alternatively, the daemon deps can be managed as a workspace or simply listed in a `daemon/package.json` that esbuild resolves during bundling.

## Architecture Summary

```
UI Server (existing + ssh2)
  |
  |-- ssh2 connection per remote host
  |     |
  |     |-- Channel 1: exec("node ~/.ccud/ccud.mjs")
  |     |     |-- stdin/stdout: JSON-RPC 2.0 (newline-delimited)
  |     |     |-- Handles: file ops, git ops, file watching, Claude CLI
  |     |
  |     |-- Channel 2: shell({rows, cols, term})
  |     |     |-- Raw PTY stream: piped to/from WebSocket/xterm.js
  |     |
  |     |-- SFTP: daemon deployment/updates only
  |
Remote Host
  |-- ~/.ccud/ccud.mjs (single bundled file, deployed via SFTP)
  |     |-- JSON-RPC server on stdin/stdout
  |     |-- chokidar for file watching
  |     |-- spawns git commands for git operations
  |     |-- spawns Claude CLI for AI chat
```

## Protocol Design Notes

### JSON-RPC Message Flow

**Client (UI server) -> Daemon:**
```json
{"jsonrpc":"2.0","method":"fs.readFile","params":{"path":"/home/user/project/src/app.ts"},"id":1}
{"jsonrpc":"2.0","method":"fs.watch","params":{"path":"/home/user/project","recursive":true},"id":2}
{"jsonrpc":"2.0","method":"git.status","params":{"cwd":"/home/user/project"},"id":3}
```

**Daemon -> Client (responses):**
```json
{"jsonrpc":"2.0","result":{"content":"import React...","encoding":"utf-8"},"id":1}
{"jsonrpc":"2.0","result":{"watching":true},"id":2}
{"jsonrpc":"2.0","result":{"modified":["src/app.ts"],"untracked":["new-file.js"]},"id":3}
```

**Daemon -> Client (notifications, no id):**
```json
{"jsonrpc":"2.0","method":"fs.changed","params":{"event":"change","path":"src/app.ts"}}
{"jsonrpc":"2.0","method":"fs.changed","params":{"event":"add","path":"new-file.js"}}
```

### Connection Lifecycle

1. UI server creates ssh2 `Client`, connects with key auth
2. Opens exec channel: `node ~/.ccud/ccud.mjs --version 1.0.0`
3. Daemon starts, writes `{"jsonrpc":"2.0","method":"ready","params":{"version":"1.0.0"}}` to stdout
4. UI server begins sending JSON-RPC requests
5. Daemon responds and sends notifications (file watch events)
6. On disconnect: UI server detects via ssh2 `close` event, attempts reconnection
7. On reconnect: re-establish exec channel, daemon restarts fresh (stateless design)

### Keepalive Strategy

```javascript
const conn = new Client();
conn.connect({
  host, port, username, privateKey,
  keepaliveInterval: 10000,  // 10s SSH keepalive packets
  keepaliveCountMax: 3,      // disconnect after 30s no response
  readyTimeout: 20000,       // 20s handshake timeout
});
```

## Version Compatibility

| Component | Minimum Version | Notes |
|-----------|----------------|-------|
| Node.js (UI server) | 22 | Already required by the project |
| Node.js (remote host) | 20 | Minimum for chokidar v4. Claude Code requires Node 18+, so 20 is safe. |
| OpenSSH (remote) | 7.0+ | For modern key exchange. Any server from the last decade. |
| ssh2 | 1.16+ | Tested against OpenSSH 8.7, works with 7.0+. |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ssh2 maintainer goes inactive | LOW | MEDIUM | Pure JS, stable protocol. Fork-friendly. 1900+ dependents ensure community interest. |
| Chokidar inotify limit on remote | MEDIUM | LOW | Configurable via sysctl. Document in setup. Same issue exists locally already. |
| Daemon bundling breaks with native deps | LOW | MEDIUM | Keep daemon pure JS (no native modules). If Claude CLI spawning needs node-pty, use the host's installed copy, not a bundled one. |
| SSH key auth too restrictive | LOW | LOW | Key-only is the right call for v1. Password auth can be added later via ssh2's `authHandler`. |
| jsonrpc-lite unmaintained (last publish 5y ago) | LOW | LOW | It is feature-complete. JSON-RPC 2.0 spec is frozen. The library does one thing and does it correctly. Zero dependencies means zero supply chain risk. |

## Sources

- [ssh2 on npm](https://www.npmjs.com/package/ssh2) -- v1.17.0, npm registry verified
- [ssh2 on GitHub](https://github.com/mscdex/ssh2) -- API docs, PTY support, SFTP, keepalive options
- [json-rpc-2.0 on npm](https://www.npmjs.com/package/json-rpc-2.0) -- v1.7.1, transport-agnostic framework
- [jsonrpc-lite on npm](https://www.npmjs.com/package/jsonrpc-lite) -- v2.2.0, zero-dep parser/serializer
- [jsonrpc-lite on GitHub](https://github.com/teambition/jsonrpc-lite) -- API reference
- [jayson on GitHub](https://github.com/tedeh/jayson) -- v4.3.0, 12 runtime deps (rejected)
- [node-ssh on npm](https://www.npmjs.com/package/node-ssh) -- v13.2.1, convenience wrapper (rejected)
- [chokidar on GitHub](https://github.com/paulmillr/chokidar) -- v4/v5 comparison
- [esbuild on GitHub](https://github.com/evanw/esbuild) -- v0.27.4, Node.js bundling
- [MCP Transports Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) -- stdio JSON-RPC framing pattern (newline-delimited, UTF-8, stderr for logs)
- [VS Code Remote SSH docs](https://code.visualstudio.com/docs/remote/ssh) -- daemon architecture inspiration
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification) -- protocol spec
