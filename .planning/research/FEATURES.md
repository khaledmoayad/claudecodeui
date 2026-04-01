# Feature Landscape: Remote SSH Project Management

**Domain:** Remote development over SSH for AI coding UI
**Researched:** 2026-04-01
**Competitors studied:** VS Code Remote SSH, JetBrains Gateway, Zed Remote, Coder, Gitpod/Ona

## Table Stakes

Features users expect from any remote development tool. Missing any of these and users will reject the feature as broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SSH connection configuration (host, port, user, key) | Every remote tool starts here. VS Code, JetBrains, Zed all have this. | Low | Store in existing SQLite DB. Support `~/.ssh/config` parsing for auto-discovery later (v2). |
| Connection testing before save | JetBrains Gateway and VS Code both validate before committing config. Users need to know if credentials work. | Low | Simple SSH handshake test. Show success/failure inline in the wizard. |
| Connection status indicator | VS Code shows host name in status bar; JetBrains shows connection health. Users must always know if they are working locally or remotely. | Low | Badge/indicator on project card and in active project header. States: connected, connecting, reconnecting, disconnected, error. |
| Remote file tree browsing | Core of VS Code Remote: open folder, browse files, navigate directories. This is the primary way users interact with remote projects. | Medium | Daemon must implement `readdir`, `stat`, `readFile`. Must feel as responsive as local. Needs caching strategy for directory listings. |
| Remote file reading/editing | VS Code Remote, JetBrains Gateway: open any file, edit, save. Without this the feature is useless. | Medium | `readFile`/`writeFile` over JSON-RPC. The existing CodeMirror editor component works as-is; only the data source changes. |
| Remote terminal/PTY | VS Code provides full integrated terminal on remote host. JetBrains Gateway does the same. Users expect to run commands on the remote machine. | High | PTY over JSON-RPC via SSH stdio. Must handle resize, input/output streaming, and session persistence. Highest-latency feature. |
| Remote git operations | The app already has a rich git panel (status, diff, commit, branches, push/pull, discard). All of this must work for remote projects. | High | 18+ git routes in `server/routes/git.js` that all call `spawn('git', ...)`. Each needs a remote equivalent via daemon. Batch where possible to reduce round-trips. |
| Remote AI chat (Claude on remote host) | The app's core purpose is AI-assisted coding. Claude CLI must run on the remote host where the project files live, so tools and MCP work correctly. | High | Daemon spawns Claude process, streams output back via JSON-RPC. Must handle the same NormalizedMessage protocol the client already expects. |
| Auto-deploy daemon to remote host | VS Code and Zed both auto-install their remote server on first connect. Users should not need to manually install anything on the remote machine. | Medium | SCP the `ccud` binary, verify Node.js availability, start the daemon. Must handle different OS/arch (Linux x86_64, ARM64 at minimum). |
| Reconnection handling | VS Code has configurable max reconnection attempts. Zed preserves state across disconnects. Connection drops are inevitable; the UX must handle them gracefully. | High | Buffer unsent commands locally. Show "reconnecting" state. Resume file watching and terminal sessions after reconnect. Critical for user trust. |
| "Add Remote Project" in creation wizard | The existing project creation wizard is the entry point. Remote must be a first-class option alongside local. | Medium | New step/tab in `ProjectCreationWizard.tsx`. Collects SSH config, tests connection, selects remote directory, creates project entry. |

## Differentiators

Features that set the product apart. Not expected by every user, but valued when present. These move the product from "basic SSH support" to "polished remote development."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Seamless local/remote project switching | Unlike VS Code (one window per remote), this UI manages multiple projects across multiple hosts in a single view. Switch between local and remote projects in the sidebar without reconnecting. | Medium | The `ProjectOperations` abstraction layer makes this possible. Connection pool stays alive across project switches. |
| Remote file watching for live updates | VS Code does this via its remote server (chokidar-equivalent). File tree auto-updates when files change on the remote host (e.g., after git pull, AI edits). | Medium | Daemon runs `chokidar` or `fs.watch` on the remote host, sends change events over JSON-RPC. Debounce to avoid flood. May need to limit watched depth. |
| Daemon version management and auto-update | Coder does sophisticated version management. Users should never have to think about whether the daemon is up to date. | Medium | On connect, check daemon version. If stale, SCP new binary, restart daemon, resume session. Must be seamless. |
| SSH config file import | VS Code reads `~/.ssh/config` for host auto-discovery. Power users already have their hosts configured there. | Low | Parse SSH config, offer discovered hosts in the wizard. Reduces setup friction significantly for users with many servers. |
| Connection multiplexing / keep-alive | VS Code uses SSH ControlMaster for connection reuse. The `ssh2` library supports keepAlive intervals and multiple channels over one connection. | Medium | Single SSH connection per host, multiple JSON-RPC channels (file ops, terminal, chat). Reduces overhead and auth prompts. |
| Graceful degradation during disconnect | Zed backs up unsaved changes locally and preserves language server state across reconnects. Users can continue reading cached files while disconnected. | High | Cache last-known file tree and open file contents locally. Queue writes for replay on reconnect. Show stale data indicator. Complex state management. |
| Per-host settings (working directory, env vars) | JetBrains allows per-remote configuration. Different servers may need different default paths or environment setup. | Low | Store in DB alongside connection config. Apply when spawning daemon processes. |
| Batch operations to reduce latency | Coder's latency blog emphasizes minimizing round-trips. Batch git status + diff + branches into a single RPC call rather than 3 sequential HTTP requests. | Medium | JSON-RPC supports batch requests. Design daemon API to accept multi-method calls. Biggest impact on git panel load time. |

## Anti-Features

Features to deliberately NOT build. These either add excessive complexity, fall outside scope, or would be better handled by other tools.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Port forwarding / tunnel management | VS Code and JetBrains provide this, but it adds significant complexity (UI for managing forwarded ports, auto-detection, conflict handling). Out of scope per PROJECT.md. | Users can manage port forwarding via their own SSH config (`LocalForward`) or use tools like Tailscale. Document this in help text. |
| System resource monitoring (CPU, memory, disk) | Explicitly excluded by maintainer in PROJECT.md. Adds dashboard scope creep. | Users who need this have htop/btop on the remote host, accessible via the remote terminal. |
| Password-based SSH auth | Key-based auth is more secure and standard. Password auth adds complexity (interactive prompts, security concerns). PROJECT.md defers this. | Support key-based auth only in v1. Add password auth later if user demand warrants it. |
| Taskmaster integration over SSH | PROJECT.md explicitly hides this for remote projects. Proxying adds complexity for questionable v1 value. | Hide Taskmaster UI elements for remote projects. Re-evaluate in v2. |
| Remote Docker/container management | Separate concern entirely. VS Code Dev Containers is a distinct extension, not part of Remote SSH. | Out of scope. Users manage containers via remote terminal. |
| Multi-user access to same remote host | The app follows a single-user model for local projects. Introducing multi-user adds collaboration protocol complexity (see Zed's challenges). | Keep single-user model. One connection per host per UI instance. |
| File sync / offline editing mode | Mutagen-style bidirectional sync adds massive complexity (conflict resolution, CRDT, partial state). VS Code Remote does not do this either. | Read-only cached view during disconnect at most. No bidirectional sync. |
| Full IDE features on remote (extensions, LSP, linting) | VS Code installs extensions remotely. This app is not an IDE -- it is a UI for AI coding CLIs. The AI agent handles code intelligence. | The AI provider (Claude, Cursor, etc.) running on the remote host IS the intelligence layer. No need for separate LSP. |
| SSH agent forwarding management | Complex security implications. Users who need agent forwarding can configure it in their SSH config. | Document SSH config options for power users. Do not build UI for this. |
| Remote MCP server management | PROJECT.md explicitly excludes this. Claude on the remote host handles its own MCP tools natively. | No proxy needed. Claude's MCP tools work in the remote environment where files live. |

## Feature Dependencies

```
SSH Connection Config ─────────────┐
                                   v
Connection Testing ──────> Add Remote Project (Wizard)
                                   │
                                   v
Auto-deploy Daemon ──────> Daemon Running on Host
                                   │
            ┌──────────────────────┼──────────────────────┐
            v                      v                      v
   Remote File Tree          Remote Terminal        Remote AI Chat
            │                      │                      │
            v                      v                      v
   Remote File Edit          Remote Git Ops         Chat Streaming
            │                      │
            v                      v
   Remote File Watch       Connection Status
            │                      │
            └──────────────────────┘
                      │
                      v
           Reconnection Handling
                      │
                      v
           Daemon Version Mgmt
```

Key dependency chains:
- **Everything requires SSH config + daemon deployment** -- no remote feature works without a running daemon
- **File tree must come before file editing** -- you need to browse before you open
- **Terminal and git can be built in parallel** -- both depend on daemon but not on each other
- **AI chat depends on daemon** but is architecturally independent from file/git operations
- **Reconnection handling is cross-cutting** -- must be designed into the connection layer from the start, not bolted on later
- **File watching depends on file tree** -- needs the same directory context
- **ProjectOperations abstraction is foundational** -- must exist before any remote route handler

## MVP Recommendation

### Phase 1: Foundation (must ship together)
1. **SSH connection configuration** -- the entry point
2. **Connection testing** -- validates the config
3. **Add Remote Project wizard** -- creates the project entry
4. **Auto-deploy daemon** -- gets ccud running on the host
5. **Connection status indicator** -- users must know connection state
6. **ProjectOperations abstraction** -- enables all routes to work for both local and remote

### Phase 2: Core Remote Operations (must ship together)
1. **Remote file tree browsing** -- primary navigation
2. **Remote file reading/editing** -- primary interaction
3. **Remote terminal/PTY** -- essential for developers
4. **Reconnection handling** -- cannot ship remote without this

### Phase 3: Full Feature Parity
1. **Remote git operations** -- the app's git panel is a major feature
2. **Remote AI chat** -- the app's core purpose
3. **Remote file watching** -- makes the experience feel live

### Defer to v2
- **SSH config file import** -- nice-to-have, not blocking
- **Batch RPC operations** -- optimization, not functionality
- **Graceful degradation during disconnect** -- complex, diminishing returns
- **Daemon auto-update** -- can prompt user to reconnect manually in v1

**Rationale:** Phase 1 is infrastructure -- nothing works without it. Phase 2 delivers the minimum viable remote experience (browse, edit, run commands). Phase 3 completes the experience to match the existing local feature set. Reconnection is in Phase 2, not Phase 3, because without it the feature is too fragile for real use.

## Sources

- [VS Code Remote SSH documentation](https://code.visualstudio.com/docs/remote/ssh) -- HIGH confidence, authoritative
- [Zed Remote SSH blog post](https://zed.dev/blog/remote-development) -- HIGH confidence, architecture details
- [JetBrains Gateway documentation](https://www.jetbrains.com/help/idea/remote-development-a.html) -- HIGH confidence
- [Coder low-latency remote development](https://coder.com/blog/achieving-low-latency-remote-development) -- MEDIUM confidence, latency patterns
- [JetBrains 10 Remote Development Best Practices](https://blog.jetbrains.com/codecanvas/2025/07/10-remote-development-best-practices/) -- MEDIUM confidence, best practices
- [Cloudomation remote development tools comparison](https://cloudomation.com/cloudomation-blog/remote-development-environments-tools/) -- MEDIUM confidence, feature landscape
- [VS Code Remote SSH marketplace](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) -- HIGH confidence, extension capabilities
- [ssh2 npm package](https://www.npmjs.com/package/ssh2) -- HIGH confidence, library capabilities
- [Remote AI Coding with Claude Code and Tailscale](https://tsoporan.com/blog/remote-ai-development-claude-code-tailscale/) -- MEDIUM confidence, real-world workflow
