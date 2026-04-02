# Requirements: Remote SSH Project Support

**Defined:** 2026-04-01
**Core Value:** One UI instance manages projects across multiple remote machines with the same UX as local projects.

## v1 Requirements

### Connection

- [x] **CONN-01**: User can add a remote host with hostname, port, username, and SSH private key path
- [x] **CONN-02**: User can test SSH connectivity before saving a host configuration
- [x] **CONN-03**: User can see connection status (connected, connecting, reconnecting, disconnected, error) on each remote project
- [x] **CONN-04**: Dropped SSH connections auto-reconnect with exponential backoff
- [x] **CONN-05**: User can edit or delete a saved remote host configuration
- [x] **CONN-06**: SSH connection config is stored in the existing SQLite database

### Daemon

- [x] **DAEM-01**: ccud daemon is auto-deployed to the remote host via SFTP on first connect
- [x] **DAEM-02**: Daemon communicates over JSON-RPC 2.0 via SSH stdio (newline-delimited)
- [x] **DAEM-03**: Daemon is bundled as a single .mjs file with no remote npm install required
- [x] **DAEM-04**: Daemon version is checked on connect and auto-updated if stale
- [x] **DAEM-05**: Daemon supports batch JSON-RPC requests to reduce round-trip latency
- [x] **DAEM-06**: Orphan daemon processes are cleaned up (PID file, heartbeat, stdin EOF detection)

### Filesystem

- [x] **FS-01**: User can browse the remote file tree (directories and files)
- [x] **FS-02**: User can open and read remote files in the existing CodeMirror editor
- [x] **FS-03**: User can edit and save remote files
- [x] **FS-04**: User can create, rename, and delete remote files and directories
- [x] **FS-05**: Remote file tree auto-updates when files change on the remote host (file watching)

### Terminal

- [x] **TERM-01**: User can open a terminal session on the remote host with full PTY support
- [x] **TERM-02**: Remote terminal supports resize events
- [x] **TERM-03**: User can have multiple simultaneous remote terminal sessions

### Git

- [x] **GIT-01**: User can view git status, diff, and log for remote projects
- [x] **GIT-02**: User can stage, unstage, commit, and discard changes on remote projects
- [x] **GIT-03**: User can create, switch, and delete branches on remote projects
- [x] **GIT-04**: User can push and pull on remote projects
- [x] **GIT-05**: All existing git panel features work identically for remote projects

### AI Chat

- [ ] **CHAT-01**: User can start a Claude Code session on the remote host where the project files live
- [ ] **CHAT-02**: Remote Claude chat streams messages in the same NormalizedMessage format as local
- [ ] **CHAT-03**: Remote Claude sessions support the same tool approval flow as local sessions
- [x] **CHAT-04**: User can list and resume existing remote Claude sessions

### Frontend

- [ ] **UI-01**: "Add Remote Project" option appears in the project creation wizard
- [ ] **UI-02**: Wizard collects SSH config, tests connection, and lets user select a remote directory
- [x] **UI-03**: Remote projects appear alongside local projects in the sidebar with a visual distinction
- [x] **UI-04**: Taskmaster UI elements are hidden for remote projects
- [x] **UI-05**: All remote-specific UI strings are added to i18n translation files

### Abstraction

- [x] **ABS-01**: ProjectOperations interface abstracts local vs remote for filesystem operations
- [x] **ABS-02**: ProjectOperations interface abstracts local vs remote for git operations
- [x] **ABS-03**: ProjectOperations interface abstracts local vs remote for terminal/PTY spawning
- [x] **ABS-04**: All existing routes use ProjectOperations instead of direct fs/spawn calls
- [x] **ABS-05**: Existing local project functionality is completely unchanged

## v2 Requirements

### Connection Enhancements

- **CONN-V2-01**: User can import hosts from ~/.ssh/config file
- **CONN-V2-02**: User can configure per-host settings (default working directory, environment variables)
- **CONN-V2-03**: Graceful degradation with cached read-only view during disconnect

### Security

- **SEC-V2-01**: User can authenticate with SSH password (in addition to key-based)
- **SEC-V2-02**: User can use SSH agent forwarding

### Operations

- **OPS-V2-01**: Support for remote hosts without Node.js (standalone daemon binary)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Port forwarding / tunnel management | High complexity, users handle via SSH config or Tailscale |
| System resource monitoring (CPU, memory, disk) | Explicitly excluded by maintainer |
| Password-based SSH auth | Deferred to v2; key-based is more secure and standard |
| Taskmaster integration over SSH | Explicitly hidden for remote projects; complexity not worth v1 value |
| Remote Docker/container management | Separate concern; users manage via remote terminal |
| Multi-user access to same remote host | Single-user model matches local behavior |
| File sync / offline editing | Massive complexity (conflict resolution, CRDT); VS Code doesn't do this either |
| Full IDE features (extensions, LSP, linting) | App is a UI for AI coding CLIs, not an IDE; Claude provides code intelligence |
| SSH agent forwarding management | Complex security implications; defer to v2 |
| Remote MCP server management | Claude on remote host handles its own MCP tools natively |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 1 | Complete |
| CONN-02 | Phase 1 | Complete |
| CONN-03 | Phase 4 | Complete |
| CONN-04 | Phase 1 | Complete |
| CONN-05 | Phase 1 | Complete |
| CONN-06 | Phase 1 | Complete |
| DAEM-01 | Phase 1 | Complete |
| DAEM-02 | Phase 1 | Complete |
| DAEM-03 | Phase 1 | Complete |
| DAEM-04 | Phase 1 | Complete |
| DAEM-05 | Phase 1 | Complete |
| DAEM-06 | Phase 1 | Complete |
| FS-01 | Phase 2 | Complete |
| FS-02 | Phase 2 | Complete |
| FS-03 | Phase 2 | Complete |
| FS-04 | Phase 2 | Complete |
| FS-05 | Phase 3 | Complete |
| TERM-01 | Phase 2 | Complete |
| TERM-02 | Phase 2 | Complete |
| TERM-03 | Phase 2 | Complete |
| GIT-01 | Phase 3 | Complete |
| GIT-02 | Phase 3 | Complete |
| GIT-03 | Phase 3 | Complete |
| GIT-04 | Phase 3 | Complete |
| GIT-05 | Phase 3 | Complete |
| CHAT-01 | Phase 3 | Pending |
| CHAT-02 | Phase 3 | Pending |
| CHAT-03 | Phase 3 | Pending |
| CHAT-04 | Phase 3 | Complete |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Complete |
| UI-04 | Phase 4 | Complete |
| UI-05 | Phase 4 | Complete |
| ABS-01 | Phase 2 | Complete |
| ABS-02 | Phase 2 | Complete |
| ABS-03 | Phase 2 | Complete |
| ABS-04 | Phase 2 | Complete |
| ABS-05 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after roadmap creation*
