# Project Research Summary

**Project:** Remote SSH Project Support for Claude Code UI
**Domain:** SSH remote development (daemon-based, JSON-RPC over stdio)
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

This project adds remote SSH project support to an existing AI coding UI (Claude Code UI). The proven approach, used by VS Code Remote SSH, JetBrains Gateway, and Zed, is a client-daemon architecture: a lightweight daemon process runs on the remote host performing local file, git, and shell operations, communicating with the UI server over a structured protocol tunneled through SSH. The recommended stack is lean -- `ssh2` for SSH connectivity and `jsonrpc-lite` for protocol parsing are the only new runtime dependencies. The daemon is a single bundled JS file deployed via SFTP, using newline-delimited JSON-RPC 2.0 over SSH channel stdio (the same transport pattern MCP uses). No new database, no new frontend framework, no port forwarding -- the existing architecture absorbs this feature through a ProjectOperations strategy pattern that makes local and remote projects interchangeable at the route level.

The key architectural decision is the ProjectOperations abstraction: define a common interface for all project I/O (files, git, shell, watch), implement it twice (LocalOperations wrapping existing fs/child_process calls, RemoteOperations proxying over JSON-RPC to the daemon), and use a factory to resolve the correct implementation per project. This mirrors the existing ProviderAdapter pattern already in the codebase. The daemon itself is straightforward -- a JSON-RPC server on stdin/stdout that executes file operations, spawns git commands, manages PTY sessions, and runs chokidar for file watching, all on the remote host's local filesystem.

The critical risks are concentrated in the protocol and connection layers, not in feature logic. Stdout contamination (stray console.log or shell profile output breaking JSON-RPC), message framing bugs (partial JSON from chunked SSH streams), SSH connection event handler leaks (crashing the server on unhandled errors), and orphan daemon processes (zombies accumulating on remote hosts after disconnects) are all well-documented failure modes from VS Code Remote's history. Every one of them must be addressed in Phase 1, not retrofitted later. The feature dependency chain is strict: nothing works without a reliable SSH connection, a correctly-deployed daemon, and a clean protocol layer. Build bottom-up.

## Key Findings

### Recommended Stack

Only two new runtime dependencies are needed. The stack leverages existing project technologies (better-sqlite3, chokidar, esbuild via Vite) and avoids framework-level libraries in favor of minimal, focused tools. See [STACK.md](./STACK.md) for full rationale and alternatives considered.

**Core technologies:**
- **ssh2 ^1.17.0**: SSH client (connections, exec channels, shell/PTY, SFTP) -- pure JS, no native deps, battle-tested with 1900+ dependents. Provides everything: PTY allocation, stdin/stdout streams for JSON-RPC, SFTP for daemon deployment, keepalive.
- **jsonrpc-lite ^2.2.0**: JSON-RPC 2.0 message parser/serializer -- zero dependencies, codec-only (no transport opinions). Matches MCP's stdio transport pattern exactly.
- **esbuild ^0.27.4 (dev)**: Bundles daemon into a single deployable `.mjs` file. Sub-second builds, `--platform=node` handles builtins correctly, no native modules in the daemon so bundling is clean.
- **chokidar ^4.0.3 (bundled in daemon)**: File watching on the remote host -- already used in the main server, same version for behavioral consistency.
- **better-sqlite3 (existing)**: SSH connection config storage in a new `remote_hosts` table. No new database dependency.

**Critical version requirements:** Node.js 20+ on remote hosts (chokidar v4 minimum, Claude Code requires 18+). Node.js 22 on the UI server (existing project requirement).

### Expected Features

Feature research studied VS Code Remote SSH, JetBrains Gateway, Zed Remote, and Coder. See [FEATURES.md](./FEATURES.md) for the full landscape, dependency graph, and anti-features list.

**Must have (table stakes):**
- SSH connection configuration, testing, and persistence
- "Add Remote Project" wizard integrated into the existing project creation flow
- Auto-deploy daemon to remote host (users should not manually install anything)
- Connection status indicator (connected/connecting/reconnecting/disconnected/error)
- Remote file tree browsing and file reading/editing
- Remote terminal/PTY via ssh2 shell channels
- Remote git operations (18+ existing git routes need remote equivalents)
- Remote AI chat (Claude CLI running on the remote host)
- Reconnection handling (connection drops are inevitable; the UX must recover gracefully)

**Should have (differentiators):**
- Seamless local/remote project switching in a single UI (unlike VS Code's one-window-per-remote model)
- Remote file watching for live UI updates (chokidar on daemon, events via JSON-RPC notifications)
- Daemon version management and auto-update on connect
- SSH config file import for host auto-discovery
- Batch JSON-RPC operations to reduce round-trip latency (especially for git panel)

**Defer (v2+):**
- SSH config file import, batch RPC optimization, graceful degradation during disconnect, password-based auth, port forwarding, system resource monitoring, Taskmaster integration over SSH

### Architecture Approach

Three new layers are added to the existing monolith: a remote daemon (`ccud`), an SSH connection manager, and a ProjectOperations abstraction. The architecture follows the Strategy pattern -- routes call `getOperations(projectName)` which returns either LocalOperations or RemoteOperations transparently. All communication with the daemon uses JSON-RPC 2.0 over newline-delimited stdio through a single SSH exec channel. PTY sessions are multiplexed via unique IDs with notification-based data streaming. See [ARCHITECTURE.md](./ARCHITECTURE.md) for component boundaries, data flow diagrams, and code sketches.

**Major components:**
1. **ProjectOperations interface** (`server/operations/types.js`) -- Defines all project I/O methods (readFile, writeFile, readdir, stat, createPty, spawnCommand, watch, dispose). Factory resolves Local vs Remote.
2. **SSHConnectionManager** (`server/ssh/connection-manager.js`) -- Manages ssh2 connections with lifecycle state machine (disconnected > connecting > deploying > initializing > ready), keepalive, reconnection with exponential backoff, reference counting.
3. **SSHTransport** (`server/ssh/transport.js`) -- JSON-RPC framing over ssh2 channel: request/response correlation via pending map, notification routing, timeout management.
4. **DaemonDeployer** (`server/ssh/deployer.js`) -- SFTP upload of bundled daemon, Node.js version check, atomic deploy (temp path then move), checksum verification.
5. **ccud daemon** (`daemon/`) -- JSON-RPC server on stdin/stdout. Handles fs ops, git spawning, PTY management (node-pty with multiplexed sessions), chokidar file watching, Claude CLI spawning. Bundled into a single `.mjs` file by esbuild.
6. **RemoteOperations** (`server/operations/remote.js`) -- Implements ProjectOperations by delegating to SSHTransport. Translates JSON-RPC errors into application errors.
7. **LocalOperations** (`server/operations/local.js`) -- Wraps existing fs/child_process/node-pty calls behind the ProjectOperations interface. Proves the interface is correct before remote implementation.

### Critical Pitfalls

Fifteen pitfalls were identified, five critical. All critical pitfalls must be addressed in Phase 1. See [PITFALLS.md](./PITFALLS.md) for the full list with detection strategies and code-level prevention.

1. **Stdout contamination breaks JSON-RPC** -- Any stray output to stdout (console.log, Node.js warnings, .bashrc banners) corrupts the protocol. Prevention: stderr-only logging from day one, `bash --norc --noprofile` for daemon launch, stdout validation layer.
2. **Message framing bugs with chunked streams** -- TCP/SSH delivers data in arbitrary chunks; naive JSON.parse per data event fails under load. Prevention: proper line-delimited parser with remainder buffer, StringDecoder for UTF-8 safety, maximum message size limit.
3. **SSH event handler leaks and zombie connections** -- Missing error handlers crash the server; `.on()` instead of `.once()` causes listener accumulation; no cleanup leaves zombie connections. Prevention: connection manager wrapping ALL ssh2 events, `.once()` for one-time events, error handler attached BEFORE `.connect()`, reference counting.
4. **Orphan daemon processes on remote hosts** -- Disconnection leaves the daemon (and its children) running. Over time, users accumulate dozens of zombie processes. Prevention: PID file, stdin EOF detection with self-terminate, kill existing daemon on reconnect, process group cleanup on exit.
5. **Leaky local/remote abstraction** -- Remote operations have fundamentally different failure modes and latency. Code that assumes local-like behavior breaks silently. Prevention: async-first interface, `path.posix` for all remote paths, operation timeouts at the abstraction layer, batch operations, explicit remote-ness in UI.

## Implications for Roadmap

Based on combined research, the build order follows a strict bottom-up dependency chain. The architecture research identified 5 layers; the features research identified 3 phases; the pitfalls research mapped warnings to phases. Synthesizing these, the recommended structure is 5 phases.

### Phase 1: Protocol and Connection Foundation
**Rationale:** Everything depends on a working SSH connection, a deployed daemon, and a reliable protocol layer. The four most critical pitfalls (stdout contamination, message framing, event handler leaks, orphan processes) all live here. Get this wrong and nothing else works.
**Delivers:** SSH connection management, daemon deployment, JSON-RPC transport, daemon scaffold with handshake, SSH config CRUD + database schema, connection lifecycle state machine.
**Addresses features:** SSH connection configuration, connection testing, auto-deploy daemon, connection status indicator (backend).
**Avoids pitfalls:** P1 (stdout contamination), P2 (message framing), P3 (event handler leaks), P4 (orphan processes), P7 (SSH key auth edge cases), P8 (daemon deployment failures), P11 (request ID management), P13 (channel limits), P14 (schema migration), P15 (daemon startup race).
**Key decision:** The daemon must be designed as stderr-only from the first line of code. The connection manager must handle ALL ssh2 events. These are not things to "add later."

### Phase 2: ProjectOperations Abstraction
**Rationale:** Before implementing any remote feature, the abstraction layer must exist and be proven correct. LocalOperations must be built first (wrapping existing fs/child_process calls) to validate the interface, then RemoteOperations implements the same interface over JSON-RPC. Existing routes are migrated once to use `getOperations()`. This is the riskiest design phase -- the leaky abstraction pitfall (P5) is most dangerous here.
**Delivers:** ProjectOperations interface, LocalOperations, RemoteOperations, route migration, `remote-path.js` utility.
**Addresses features:** Foundation for all remote file, git, and shell operations.
**Avoids pitfalls:** P5 (leaky abstraction), P12 (cross-platform path handling).
**Key decision:** Every method must be explicitly async and error-aware. Use `path.posix` for all remote paths. Add per-operation timeouts. Replace any `*Sync` calls in abstracted code paths.

### Phase 3: Core Remote Experience
**Rationale:** With the protocol layer and abstraction in place, the core remote features can be built. File tree, file editing, and terminal are the minimum viable remote experience. These can be built somewhat in parallel since they share the same transport but are independent features.
**Delivers:** Remote file tree browsing, remote file reading/editing, remote terminal via ssh2 shell channels, "Add Remote Project" wizard, connection status UI.
**Addresses features:** Remote file tree, remote file read/edit, remote terminal/PTY, Add Remote Project wizard, connection status indicator (frontend).
**Avoids pitfalls:** P6 (PTY data integrity -- base64 encoding, flow control).

### Phase 4: Full Feature Parity
**Rationale:** Git operations and AI chat are high-complexity features that depend on the daemon's `spawnCommand` infrastructure being proven. File watching depends on the notification mechanism being reliable. These complete the remote experience to match local feature parity.
**Delivers:** Remote git operations (status, diff, log, commit, branches, push/pull), remote AI chat (Claude CLI on remote), remote file watching, reconnection handling.
**Addresses features:** Remote git operations, remote AI chat, remote file watching, reconnection handling.
**Avoids pitfalls:** P9 (file watching scalability -- lazy watching, exclude heavy dirs), P10 (reconnection state sync -- session IDs, stale state detection).

### Phase 5: Polish and Differentiators
**Rationale:** With full feature parity achieved, this phase adds the differentiating features and optimizations that make the remote experience feel polished rather than "functional but rough."
**Delivers:** Daemon auto-update on connect, batch RPC for git panel performance, seamless local/remote project switching, per-host settings, SSH config file import.
**Addresses features:** Daemon version management, batch operations, seamless switching, per-host settings, SSH config import.

### Phase Ordering Rationale

- **Bottom-up dependency chain:** Protocol (Phase 1) > Abstraction (Phase 2) > Features (Phase 3-4) > Polish (Phase 5). Each phase builds on the previous. You cannot build remote file browsing without a working JSON-RPC transport, and you cannot build the transport without SSH connection management.
- **Risk-front-loaded:** The four critical pitfalls and the leaky abstraction risk are all addressed in Phases 1-2. By the time feature work begins in Phase 3, the foundation is solid.
- **Feature grouping matches architecture layers:** Phase 1 = transport layer, Phase 2 = abstraction layer, Phase 3 = basic operations layer, Phase 4 = advanced operations layer, Phase 5 = UX layer. This matches ARCHITECTURE.md's 5-layer build order exactly.
- **LocalOperations first:** Building LocalOperations before RemoteOperations validates the interface with zero network complexity. This is cheap insurance against abstraction design mistakes.
- **Reconnection in Phase 4, not Phase 3:** The connection manager from Phase 1 handles basic reconnection (state machine, backoff). Phase 4 adds the harder problem: state synchronization after reconnect (stale file trees, dead terminals, pending operations). Basic reconnection is built-in; sophisticated recovery is deferred.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** SSH key authentication edge cases (passphrase handling, SSH agent, ed25519 format quirks). Research the ssh2 library's `authHandler` API and agent forwarding options before implementation.
- **Phase 2:** Route migration audit. The existing `server/index.js` is 2577 lines handling 8+ responsibilities. Need to inventory every `fs.*`, `child_process.*`, and `node-pty` call to plan the migration.
- **Phase 4 (git):** The 18+ git routes in `server/routes/git.js` need to be mapped to daemon RPC methods. Some may need batching to avoid N sequential round-trips for the git panel.
- **Phase 4 (AI chat):** Claude CLI spawning on the remote host with NormalizedMessage streaming over JSON-RPC needs protocol design. How does the daemon stream partial AI responses back over the single stdio channel without blocking other operations?

Phases with standard patterns (skip research-phase):
- **Phase 3 (file tree, file edit):** Standard CRUD over JSON-RPC. Well-documented, straightforward request/response pattern.
- **Phase 3 (remote terminal):** ssh2's `client.shell()` handles PTY allocation natively. The existing xterm.js + WebSocket flow is unchanged; only the backend pipe changes from node-pty to ssh2 shell channel.
- **Phase 5 (polish):** All features here are incremental improvements to existing patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | ssh2 and jsonrpc-lite are well-established, documented, and actively used. Version-specific capabilities verified against npm registry and GitHub repos. Zero speculative choices. |
| Features | HIGH | Feature landscape derived from studying 5+ competitors (VS Code Remote, JetBrains Gateway, Zed, Coder, Gitpod). Table stakes are unambiguous. Anti-features explicitly scoped based on PROJECT.md constraints. |
| Architecture | HIGH | Strategy/Proxy pattern is textbook. JSON-RPC over stdio is proven by MCP ecosystem at massive scale. Connection state machine informed by VS Code Remote's documented failure modes. Code sketches provided for all major components. |
| Pitfalls | HIGH | Critical pitfalls sourced from real bug reports (VS Code Remote SSH issues #258, #262, #6894, #10730, #10987), library-specific GitHub issues (ssh2 #367, #583, #969), and established computer science literature (Leaky Abstractions). Not theoretical. |

**Overall confidence:** HIGH

### Gaps to Address

- **Remote Claude CLI streaming protocol:** How to multiplex AI chat streaming (which can produce thousands of events per minute) with file operations and PTY data over a single stdio channel without head-of-line blocking. Needs design during Phase 4 planning.
- **Windows UI server to Linux remote:** The codebase currently runs on Linux. If a Windows user runs the UI server, `path.posix` usage must be rigorously enforced. Needs validation during Phase 2 testing.
- **SSH agent support vs. key file only:** Research recommends supporting `SSH_AUTH_SOCK` for agent-based auth in v1, but the UX for this (auto-detect agent vs. explicit key file selection) needs design.
- **Daemon node-pty dependency:** The daemon needs node-pty for spawning PTY processes (Claude CLI, interactive commands). node-pty is a native module that cannot be bundled by esbuild. The daemon either depends on the host's installed node-pty (requires `npm install` on remote) or uses a PTY-less approach (`child_process` with `TERM=dumb`). This tension is unresolved.
- **Large file transfer:** No research was done on handling large file reads/writes over JSON-RPC. Binary files (images, compiled assets) may need base64 encoding which inflates size 33%. A streaming/chunked approach may be needed for files over a certain size threshold.

## Sources

### Primary (HIGH confidence)
- [ssh2 on GitHub](https://github.com/mscdex/ssh2) -- API docs, PTY support, SFTP, keepalive, channel handling
- [MCP Transport Specification (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) -- stdio JSON-RPC framing (newline-delimited, UTF-8, stderr for logs)
- [VS Code Remote SSH documentation](https://code.visualstudio.com/docs/remote/ssh) -- daemon architecture, feature landscape, troubleshooting
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification) -- protocol standard
- [JetBrains Gateway documentation](https://www.jetbrains.com/help/idea/remote-development-a.html) -- feature landscape
- [jsonrpc-lite on npm](https://www.npmjs.com/package/jsonrpc-lite) -- v2.2.0, zero-dep parser/serializer

### Secondary (MEDIUM confidence)
- [VS Code Remote SSH reconnection issues](https://github.com/microsoft/vscode-remote-release/issues/10987) -- failure modes informing state machine
- [VS Code Remote orphan processes](https://github.com/microsoft/vscode-remote-release/issues/262) -- zombie process patterns
- [VS Code Remote zombie processes #10730](https://github.com/microsoft/vscode-remote-release/issues/10730) -- ongoing process cleanup challenges
- [Coder low-latency remote development](https://coder.com/blog/achieving-low-latency-remote-development) -- latency patterns and batch optimization
- [Zed Remote SSH blog post](https://zed.dev/blog/remote-development) -- architecture details and state preservation
- [ssh2 keepalive timeout issue #367](https://github.com/mscdex/ssh2/issues/367) -- keepalive behavior
- [ssh2 MaxListeners issue #583](https://github.com/mscdex/ssh2/issues/583) -- EventEmitter leaks
- [Joel Spolsky - Law of Leaky Abstractions](https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/) -- why transparent distribution fails

### Tertiary (LOW confidence)
- [VS Code Remote SSH DeepWiki Analysis](https://deepwiki.com/microsoft/vscode-remote-release/3.1-remote-ssh) -- third-party architecture analysis
- [JSON Streaming in Node: 10 Traps](https://medium.com/@ThinkingLoop/json-streaming-in-node-10-traps-and-safer-patterns-d507d10bcc7c) -- partial message parsing edge cases

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
