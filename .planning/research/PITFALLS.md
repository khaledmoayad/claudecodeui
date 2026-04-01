# Domain Pitfalls

**Domain:** SSH Remote Project Management (daemon-based, JSON-RPC over stdio)
**Researched:** 2026-04-01

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or production-breaking behavior.

---

### Pitfall 1: stdout Contamination Breaks JSON-RPC Protocol

**What goes wrong:** The ccud daemon uses stdio for JSON-RPC transport. Any stray output to stdout -- console.log debugging, Node.js warnings, npm postinstall scripts, shell profile banners (.bashrc echo statements), or uncaught error stack traces -- corrupts the protocol stream. The UI server receives malformed JSON, cannot parse it, and the entire connection dies silently or throws cryptic errors.

**Why it happens:** Developers habitually use console.log for debugging. Node.js itself emits warnings to stdout (e.g., MaxListenersExceededWarning, deprecation notices). Remote hosts may have .bashrc/.profile files that emit text on login. Child processes spawned by the daemon may inherit stdout.

**Consequences:** Complete communication failure between UI server and daemon. Intermittent failures that are extremely hard to reproduce (e.g., only happens when a specific npm warning fires). Users see "connection lost" with no actionable error.

**Prevention:**
- Redirect ALL daemon logging to stderr from day one. Never use console.log in daemon code; create a logger that writes to stderr or a log file.
- Set `TERM=dumb` and use `bash --norc --noprofile` (or `env -i`) when spawning the daemon process to prevent shell profile output.
- Wrap stdout in a validation layer: before writing to stdout, assert the output is valid JSON-RPC. In development, add a stderr warning if non-JSON data would have been written.
- Redirect child process stdout to /dev/null or capture it separately.
- Test with a remote host that has a noisy .bashrc (echo statements, motd, etc.).

**Detection:** Protocol parse errors in the UI server. "Unexpected token" JSON errors. Connection works on clean test VMs but fails on real user machines.

**Phase:** Must be addressed in Phase 1 (daemon scaffold). Retrofitting this is painful -- every console.log must be hunted down.

---

### Pitfall 2: Newline-Delimited JSON Message Framing Bugs

**What goes wrong:** JSON-RPC over stdio uses newline-delimited messages (one JSON object per line). TCP/SSH streams deliver data in arbitrary chunks. A single `data` event may contain half a message, two messages, or one and a half messages. Naive parsing (JSON.parse on each data chunk) fails intermittently under load.

**Why it happens:** Works perfectly in local testing where messages are small and arrive atomically. Breaks in production when: large file contents are transmitted (messages exceed TCP segment size), network latency causes Nagle's algorithm to coalesce small messages, or high-throughput file watching floods the channel.

**Consequences:** Silent data corruption -- partial JSON parses may sometimes "succeed" by coincidence, producing wrong data. Lost messages. Daemon appears to hang (waiting for the rest of a message that was already consumed by the previous parse).

**Prevention:**
- Implement a proper line-delimited parser with a remainder buffer from the start. Buffer incoming data, split on `\n`, parse complete lines, keep the remainder for the next chunk.
- Use `StringDecoder` for UTF-8 safety -- multi-byte characters (common in file paths and content for international users) can split across chunk boundaries.
- Flush the remainder buffer on stream end to avoid losing the final message.
- Use or adapt a battle-tested library like `split2` for the transform stream rather than hand-rolling.
- Add a maximum message size limit to prevent memory exhaustion from malformed streams.

**Detection:** Intermittent "Unexpected token" JSON parse errors under load. Works with small files, breaks with large ones. Works on fast networks, breaks on slow ones.

**Phase:** Must be addressed in Phase 1 (protocol layer). This is foundational -- every subsequent feature depends on reliable message framing.

---

### Pitfall 3: SSH Connection Event Handler Leaks and Zombie Connections

**What goes wrong:** The ssh2 library uses Node.js EventEmitters extensively. Each SSH connection has events for `ready`, `error`, `close`, `end`, `timeout`, `keyboard-interactive`, `banner`, and channel-level events. Missing an error handler causes process crashes. Registering `.on()` instead of `.once()` for one-time events causes listener accumulation. Not cleaning up on disconnect leaves zombie connections consuming memory.

**Why it happens:** ssh2's API surface is large and easy to use partially. The "happy path" works without comprehensive event handling. Memory leaks from listener accumulation are slow -- they only manifest after many connect/disconnect cycles (exactly what happens when users switch between projects or have flaky networks).

**Consequences:** `MaxListenersExceededWarning` in production. Gradual memory growth leading to OOM crashes after hours/days of use. Unhandled `error` events crashing the entire Express server process (taking down ALL users, not just the one with the bad SSH connection).

**Prevention:**
- Wrap ssh2 Client in a connection manager class that handles ALL events (ready, error, close, end, timeout, banner, greeting). Never leave the raw Client exposed.
- Always use `.once()` for events that should fire once (ready, error during connect).
- Attach an `error` handler BEFORE calling `.connect()` -- ssh2 can emit errors synchronously during connect.
- Implement connection reference counting: track active channels per connection, close the connection when the last channel closes.
- Set explicit keepalive: `keepaliveInterval: 10000, keepaliveCountMax: 3` (defaults are keepaliveInterval: 0 which means DISABLED -- connections will silently die behind NATs/firewalls).
- Set `readyTimeout: 20000` to prevent indefinite hangs on unreachable hosts.
- On server shutdown, iterate all connections and call `.end()` then `.destroy()` with a timeout.

**Detection:** Node.js MaxListenersExceededWarning in server logs. Memory growth over time (monitor with `process.memoryUsage()`). Server crashes with "Unhandled 'error' event" in stack trace pointing to ssh2.

**Phase:** Phase 1 (SSH connection management). The connection manager must be rock-solid before anything else is built on top.

---

### Pitfall 4: Orphan Daemon Processes on Remote Hosts

**What goes wrong:** When the SSH connection drops (network failure, server restart, user closes laptop), the daemon process on the remote host becomes an orphan. Without cleanup, reconnecting spawns a new daemon, leaving the old one running. Over time, users accumulate dozens of zombie Node.js processes consuming remote host memory and CPU.

**Why it happens:** SSH disconnection is not a clean shutdown signal for the daemon. The daemon's stdin (the SSH channel) gets EOF, but the process does not necessarily exit. If the daemon spawns child processes (Claude CLI, PTY shells), those become double-orphaned. This is the exact problem VS Code Remote SSH has been fighting since 2019 (issues #258, #262, #6894, #10730 on microsoft/vscode-remote-release) and still has not fully solved.

**Consequences:** User complaints about remote server memory usage. Multiple daemon instances interfering with each other (file locks, port conflicts). Reputation damage -- users blame the tool for "destroying" their server.

**Prevention:**
- Daemon must detect stdin EOF/close and self-terminate with a timeout (give pending operations 5 seconds to complete, then exit).
- Write a PID file to `~/.ccud/ccud.pid` on startup. On connection, check if an old daemon is running (kill it or reuse it).
- Implement heartbeat: daemon sends periodic heartbeat messages; if the UI server stops receiving them, it knows the daemon is dead. Conversely, if the daemon stops receiving heartbeats from the UI server (via stdin), it self-terminates.
- Set process title (`process.title = 'ccud'`) so orphans are identifiable via `ps aux | grep ccud`.
- On reconnect, the connection manager should first try to kill any existing daemon before spawning a new one: `ssh exec 'kill $(cat ~/.ccud/ccud.pid) 2>/dev/null; rm -f ~/.ccud/ccud.pid'`.
- Daemon should kill its entire process group on exit (child processes, PTY sessions) using `process.kill(-process.pid, 'SIGTERM')` or similar.

**Detection:** Multiple `ccud` processes visible on remote host. Rising memory usage on remote host over time. "Address already in use" or file lock errors on reconnect.

**Phase:** Phase 1 (daemon lifecycle). Must be designed in from the start -- adding process management to an existing daemon is a significant retrofit.

---

### Pitfall 5: The Leaky Local/Remote Abstraction

**What goes wrong:** The ProjectOperations abstraction tries to make remote projects "look like" local ones. But remote operations have fundamentally different failure modes (network errors, timeouts, partial failures), latency characteristics (10-500ms per operation vs. <1ms), and consistency guarantees (no atomic multi-file operations). Code written against the abstraction assumes local-like behavior and breaks in subtle ways on remote.

**Why it happens:** This is the classic "fallacy of transparent distribution" described by Joel Spolsky's Law of Leaky Abstractions and Waldo et al.'s "A Note on Distributed Computing." Every attempt to make remote look local eventually leaks. The existing codebase does synchronous `fs.statSync()`, sequential file reads, directory traversals that assume microsecond latency, and path operations using Node.js `path` module (which uses the LOCAL platform's separators, not the remote's).

**Consequences:** UI freezes during remote file operations. Race conditions where the UI assumes an operation completed instantly. Broken file paths (Windows UI server managing a Linux remote, or vice versa). Error messages that say "ENOENT" when the real problem is a network timeout.

**Prevention:**
- Make the abstraction explicitly async and error-aware. Every method returns `Promise<Result<T, RemoteError>>` (or equivalent error-first pattern) where `RemoteError` includes network failure as a first-class error type.
- Do NOT use Node.js `path` module for remote paths. Use `posixPath` (or a remote path utility) that always uses `/` separators, since remote hosts are Linux.
- Add operation timeouts at the abstraction layer (not just at the SSH level). Individual file reads should timeout after 10 seconds; directory listings after 30 seconds.
- Batch operations where possible: instead of N sequential file reads, send a single "readFiles" RPC that returns all results. This amortizes round-trip latency.
- Surface remote-ness in the UI: show a connection status indicator, show latency, use loading states for remote operations. Do NOT pretend it is local.
- Replace any `*Sync` fs calls in code paths that will be abstracted with async equivalents BEFORE building the abstraction.

**Detection:** UI feels sluggish on remote projects. "Not found" errors that resolve on retry. Path-related bugs that only appear on certain OS combinations. Operations that work locally but time out remotely.

**Phase:** Phase 2 (abstraction layer design). Must be designed carefully before implementing any remote operations. Changing the abstraction interface later means rewriting all consumers.

---

## Moderate Pitfalls

---

### Pitfall 6: PTY Proxying Data Integrity and Flow Control

**What goes wrong:** The existing shell implementation uses node-pty locally, spawning a PTY directly. For remote projects, PTY data must flow: remote PTY -> daemon stdout (JSON-RPC) -> SSH channel -> UI server WebSocket -> browser xterm.js. Each hop adds latency, and the JSON-RPC framing adds overhead (base64 encoding of binary terminal data, escaping special characters). Terminal rendering breaks because of: dropped bytes, reordered chunks, or encoding issues with the additional serialization layer.

**Why it happens:** Terminal data is a raw byte stream with ANSI escape sequences. JSON-RPC requires string values, so binary data must be encoded. Base64 adds 33% overhead. High-throughput scenarios (e.g., `cat large-file.log`) can overwhelm the JSON-RPC framing, and SSH channel backpressure signals (the `continue` event / false return from write) are not propagated through the proxy layers.

**Prevention:**
- Use base64 encoding for PTY data in JSON-RPC messages. It is the simplest correct approach (not "efficient," but correct and debuggable).
- Implement flow control: when the SSH channel signals backpressure (write returns false), pause the remote PTY. Resume when the `continue`/`drain` event fires.
- Set reasonable buffer limits on the terminal output buffer (the existing 5000-chunk buffer is already a good pattern to follow).
- Test with adversarial workloads: `yes`, `cat /dev/urandom | base64`, `find / -name "*.js"` on a large filesystem.
- Add a terminal data throughput cap on the daemon side to prevent flooding.

**Detection:** Garbled terminal output. Missing characters in interactive sessions. Terminal hangs during high-output commands. High memory usage in the daemon during bulk output.

**Phase:** Phase 3 (remote terminal/PTY). Test early with adversarial workloads.

---

### Pitfall 7: SSH Key Authentication Edge Cases

**What goes wrong:** The project plans key-based auth only, but the real world of SSH keys is messy. Users have: passphrase-encrypted keys (the UI must prompt or handle this), keys in non-standard locations, ed25519 keys (older ssh2 versions choke on these), PuTTY .ppk format keys (Windows users), keys with wrong permissions (ssh2 does not check permissions like ssh does, but the OS-level ssh-agent might reject them), and SSH agent-forwarded keys.

**Why it happens:** Developers test with their own key setup (usually unencrypted ed25519 or RSA in ~/.ssh/id_rsa). Real users have diverse setups. The ssh2 library handles most formats in recent versions (1.x), but error messages are cryptic: "Cannot parse privateKey" gives no hint about what is wrong with the key.

**Prevention:**
- Support passphrase-encrypted keys from v1. Add a passphrase field in the connection config (stored encrypted in the DB, or prompt on connect).
- Support SSH agent authentication (`agent: process.env.SSH_AUTH_SOCK`). Many users prefer agent-based auth; it handles passphrases transparently and supports hardware keys.
- Validate the key file on save: attempt to parse it with ssh2 and show a user-friendly error if it fails, explaining the problem (wrong format, needs passphrase, unsupported type).
- Support `~/.ssh/config` host aliases as a stretch goal -- many users configure per-host keys there.
- Store the key FILE PATH in the database, not the key contents. The key stays on disk with proper permissions; the DB just references it.

**Detection:** "Cannot parse privateKey" errors. Authentication failures that work fine with regular `ssh` command. Users on Windows unable to connect.

**Phase:** Phase 1 (SSH connection). Authentication must work reliably before anything else matters.

---

### Pitfall 8: Daemon Deployment and Version Skew

**What goes wrong:** Auto-deploying the daemon via SCP sounds simple but has many failure modes: remote host lacks Node.js (or has an incompatible version), the deploy path has wrong permissions, the daemon binary is for the wrong architecture (x86 vs ARM), SCP upload is interrupted mid-transfer leaving a corrupt binary, and version skew between the UI server and daemon causes protocol incompatibilities.

**Why it happens:** The daemon runs on the user's remote server, which the developer does not control. Unlike VS Code which ships a self-contained server binary, ccud depends on Node.js being installed on the remote. Diverse server environments (Ubuntu, CentOS, Alpine, macOS, ARM Raspberry Pis) multiply the matrix.

**Prevention:**
- Require Node.js on the remote host and check the version before deployment. Run `node --version` via ssh exec before deploying. Fail fast with a clear error message if Node.js is missing or too old.
- Upload to a temporary path first, then atomically move to the final location: `scp daemon.js remote:/tmp/ccud-staging && ssh remote 'mv /tmp/ccud-staging ~/.ccud/daemon.js'`. This prevents corrupt partial uploads.
- Include a protocol version number in the daemon's handshake. The first message from daemon to UI server should include `{ "protocol": 1, "daemonVersion": "1.0.0" }`. If versions are incompatible, auto-update before proceeding.
- Checksum verification: after upload, run `sha256sum` on the remote and compare with the local hash.
- Do not bundle native dependencies in the daemon (no node-pty on remote -- use Node.js `child_process` with `stdio: 'pipe'` and `TERM` environment variable for basic PTY behavior, or spawn `script -q /dev/null` as a PTY wrapper on Linux).

**Detection:** "Cannot find module" errors on daemon start. "SyntaxError" on daemon start (wrong Node.js version). Protocol errors after UI server update (version skew). Daemon works on Ubuntu but fails on Alpine.

**Phase:** Phase 1 (daemon deployment). A broken deploy means nothing works.

---

### Pitfall 9: File Watching Scalability on Remote Hosts

**What goes wrong:** The daemon uses inotify (via chokidar or similar) to watch for file changes on the remote host. Each watch consumes a kernel inotify watch descriptor. The default limit on Linux is 8,192 watches. A typical Node.js project has 20,000-50,000 files (including node_modules). The daemon exhausts the inotify limit, causing ENOSPC errors and failed watches -- not just for ccud but for ALL processes on that host.

**Why it happens:** The existing local codebase uses chokidar for file watching and it works because it only watches provider-specific folders, not entire project trees. The remote daemon may need to watch the entire project directory for live file updates. Recursive watching of a large project tree is the default and obvious approach, but it hits system limits fast.

**Consequences:** ENOSPC errors. Other services on the remote host (VS Code Server, webpack dev server, etc.) lose their file watches. Users must manually increase `fs.inotify.max_user_watches`, which requires sudo access they may not have.

**Prevention:**
- Do NOT recursively watch the entire project tree. Watch only the directories the user has open/visible in the file tree UI. Expand watches as the user navigates.
- Exclude `node_modules`, `.git`, `dist`, `build`, and other heavy directories by default. Make exclusions configurable.
- Implement polling fallback for when inotify watches are exhausted (chokidar supports `usePolling: true`), but warn the user about reduced performance.
- Consider a hybrid approach: use inotify for the top-level project directory and immediate children, poll for deeper changes on a longer interval.
- Report the current watch count and system limit in daemon health/status responses.

**Detection:** ENOSPC errors in daemon logs. File changes not reflected in UI. Other tools on the remote host complaining about inotify limits.

**Phase:** Phase 3 (remote file watching). Can be deferred but must be designed carefully.

---

### Pitfall 10: Reconnection State Synchronization

**What goes wrong:** SSH connections drop (Wi-Fi switching, laptop sleep, ISP blips). The UI server reconnects and spawns a new daemon (or reconnects to an existing one). But the UI client still has stale state: open terminals, file tree contents, pending operations. The UI does not know what changed on the remote during the disconnect. Terminals show stale output. File tree shows files that were deleted. Pending saves may have been lost.

**Why it happens:** The UI client has local state (open files, terminal buffers, file tree) that assumed continuous synchronization. Unlike a web app where you can just "refresh," terminal sessions have stateful PTYs that cannot be serialized and restored. The daemon may have been killed and restarted, losing all in-memory state.

**Prevention:**
- Separate reconnectable state from ephemeral state. File tree and git status can be re-fetched. Terminal sessions cannot -- mark them as "disconnected" and let the user restart.
- Assign a unique session ID to each daemon instance. On reconnect, if the daemon session ID changed, the UI knows state is stale and must be rebuilt.
- Implement request IDs with timeouts: every pending JSON-RPC request should have a timeout. On reconnect, reject all pending requests with a "connection lost" error rather than leaving them hanging forever.
- Queue file save operations during brief disconnects (< 5 seconds). Replay the queue on reconnect. For longer disconnects, warn the user about unsaved changes.
- Use optimistic UI with confirmation: show file saves as "pending" until the daemon acknowledges.

**Detection:** Stale file tree after reconnect. Terminal showing old output. "Request timed out" errors that never resolve. Lost file saves.

**Phase:** Phase 4 (reconnection handling). Can be basic initially (full state reset on reconnect) and refined later.

---

## Minor Pitfalls

---

### Pitfall 11: JSON-RPC Request ID Collision and Timeout Tracking

**What goes wrong:** With concurrent operations (file tree expansion, git status, file saves, terminal data all happening simultaneously), request IDs must be unique and response matching must be correct. Using sequential integers risks collision if the counter wraps or if multiple subsystems generate IDs independently. Responses arriving out of order, or after the request has already timed out, cause handlers to fire on the wrong context.

**Prevention:**
- Use a single monotonically increasing counter for request IDs per connection. A simple integer counter with BigInt backup for extreme cases.
- Implement a pending request map (`Map<id, { resolve, reject, timer }>`) that cleans up on timeout, response, or disconnect.
- Log and discard responses for unknown/expired request IDs rather than throwing.

**Phase:** Phase 1 (protocol layer).

---

### Pitfall 12: Cross-Platform Path Handling

**What goes wrong:** The UI server runs on one OS; the remote host runs on another. `path.join()`, `path.resolve()`, and `path.sep` use the LOCAL OS conventions. Using them for remote paths produces `\` separators on a Windows UI server talking to a Linux remote.

**Prevention:**
- Use `path.posix.join()` and `path.posix.resolve()` for ALL remote path operations. Never use `path` without the `.posix` qualifier for remote paths.
- Store remote paths as-is (forward slashes). Never normalize them with the local path module.
- Add a utility module (`remote-path.js`) that wraps path.posix and is the only import used for remote path manipulation.

**Phase:** Phase 2 (abstraction layer). Easy to get right if addressed early, painful to fix later.

---

### Pitfall 13: SSH Channel Limits and Multiplexing

**What goes wrong:** SSH allows multiple channels over a single connection, but there are practical limits. Each PTY session, file operation, and git command opens a channel. Under heavy use (multiple terminals, rapid file operations, file watching), the connection can hit channel limits or become congested.

**Prevention:**
- Reuse a SINGLE exec channel for JSON-RPC rather than opening new channels per operation. The JSON-RPC protocol already multiplexes via request IDs.
- Open separate channels only for PTY sessions (which need their own stream).
- Monitor active channel count and warn when approaching limits.

**Phase:** Phase 1 (connection architecture).

---

### Pitfall 14: Database Schema Migration for SSH Config

**What goes wrong:** Adding SSH connection config to the existing SQLite database without proper migration causes issues on upgrade. Existing installs have no ssh_connections table. The schema must handle: adding the table, adding new columns in future versions, and not losing data on upgrade.

**Prevention:**
- Use the existing database migration pattern (check if table/column exists before adding). SQLite supports `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN` with existence checks.
- Store SSH key PATHS, not key content, in the database. Key content in a plaintext SQLite DB is a security risk.
- Encrypt sensitive fields (passphrase) before storing, even if the existing DB stores credentials in plaintext. Do not make the problem worse.

**Phase:** Phase 1 (connection config storage).

---

### Pitfall 15: Daemon Startup Race with First RPC

**What goes wrong:** The UI server deploys the daemon via SCP, starts it via SSH exec, and immediately sends the first JSON-RPC request. But the daemon has not finished initializing (loading modules, setting up handlers). The first request arrives before the daemon is ready and is dropped or causes an error.

**Prevention:**
- Implement a handshake protocol: daemon sends a `ready` notification on stdout when fully initialized. The UI server waits for this notification before sending any requests.
- Set a ready timeout (10 seconds). If the daemon does not send `ready`, report a deployment error.
- Buffer any user-initiated requests during the connection setup phase and replay them after handshake completes.

**Phase:** Phase 1 (daemon lifecycle).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Daemon scaffold + protocol | stdout contamination (P1), message framing (P2), startup race (P15) | Strict stderr-only logging, battle-tested line parser, handshake protocol |
| Phase 1: SSH connection management | Event handler leaks (P3), auth edge cases (P7) | Connection manager wrapper class, test with diverse key types |
| Phase 1: Daemon deployment | Corrupt uploads (P8), Node.js version (P8), version skew (P8) | Atomic upload + version handshake |
| Phase 2: ProjectOperations abstraction | Leaky abstraction (P5), path handling (P12) | Async-first design, path.posix everywhere, explicit error types |
| Phase 3: Remote file operations | File watching scalability (P9), latency (P5) | Lazy watching, exclude heavy dirs, batch operations |
| Phase 3: Remote PTY/terminal | Data integrity (P6), backpressure (P6) | Base64 encoding, flow control, adversarial testing |
| Phase 4: Reconnection | State sync (P10), orphan processes (P4) | Session IDs, PID files, heartbeat, stale state detection |
| Phase 5: Polish | Request ID management (P11), schema migration (P14) | Monotonic IDs, proper migration scripts |

## Sources

- [ssh2 GitHub repository](https://github.com/mscdex/ssh2) - Connection options, channel handling, event API
- [ssh2 npm](https://www.npmjs.com/package/ssh2) - Keepalive configuration defaults
- [ssh2 keepalive timeout issue #367](https://github.com/mscdex/ssh2/issues/367) - Keepalive timeout bugs
- [ssh2 handshake timeout issue #969](https://github.com/mscdex/ssh2/issues/969) - Unhandled error event crashes
- [ssh2 MaxListeners issue #583](https://github.com/mscdex/ssh2/issues/583) - EventEmitter leak with ssh2
- [ssh2-sftp-client MaxListeners issue #93](https://github.com/theophilusx/ssh2-sftp-client/issues/93) - Memory leak with multiple file operations
- [MCP Transports specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) - JSON-RPC over stdio framing requirements
- [MCP serialization debugging guide](https://mcpcat.io/guides/debugging-message-serialization-errors/) - stdout contamination, message hygiene
- [JSON Streaming in Node: 10 Traps](https://medium.com/@ThinkingLoop/json-streaming-in-node-10-traps-and-safer-patterns-d507d10bcc7c) - Partial message parsing, multi-byte char splitting
- [ndjson library](https://github.com/max-mapper/ndjson) - Reference implementation for newline-delimited JSON
- [VS Code Remote SSH orphan processes #262](https://github.com/microsoft/vscode-remote-release/issues/262) - Orphan process problem history
- [VS Code Remote zombie processes #10730](https://github.com/microsoft/vscode-remote-release/issues/10730) - Ongoing zombie process issues (2025)
- [VS Code Remote leftover processes #6894](https://github.com/microsoft/vscode-remote-release/issues/6894) - Processes remain after disconnect
- [VS Code Remote process cleanup #258](https://github.com/microsoft/vscode-remote-release/issues/258) - Original orphan process report
- [VS Code Remote memory leak #9778](https://github.com/microsoft/vscode-remote-release/issues/9778) - vscode-server memory leak
- [Joel Spolsky - Law of Leaky Abstractions](https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/) - Why transparent distribution fails
- [Netflix conductor inotify issue #2984](https://github.com/Netflix/conductor/issues/2984) - ENOSPC from file watchers
- [inotify limits documentation](https://watchexec.github.io/docs/inotify-limits.html) - System limits and tuning
- [VS Code Remote troubleshooting](https://code.visualstudio.com/docs/remote/troubleshooting) - Platform detection, debugging tips
- [ed25519 key parsing issues](https://github.com/liximomo/vscode-sftp/issues/567) - ssh2 key format compatibility
- [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification) - Request ID management, batch processing
