# Roadmap: Remote SSH Project Support

## Overview

This roadmap delivers remote SSH project support for Claude Code UI in four phases, building bottom-up from a reliable protocol foundation to a polished user experience. Phase 1 establishes SSH connectivity and the daemon communication layer. Phase 2 introduces the ProjectOperations abstraction and proves it with filesystem and terminal features. Phase 3 completes feature parity with git operations, AI chat, file watching, and reconnection handling. Phase 4 wraps everything in frontend UI -- the project wizard, status indicators, sidebar integration, and i18n. Each phase delivers a verifiable capability that the next phase depends on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Protocol & Connection Foundation** - SSH connection management, daemon deployment, and JSON-RPC transport layer
- [ ] **Phase 2: Abstraction & Core Remote Operations** - ProjectOperations interface with filesystem and terminal working over SSH
- [ ] **Phase 3: Full Feature Parity** - Git operations, AI chat, file watching, and reconnection for remote projects
- [ ] **Phase 4: Frontend Integration** - Project wizard, status indicators, sidebar presentation, and i18n

## Phase Details

### Phase 1: Protocol & Connection Foundation
**Goal**: A reliable SSH connection can be established to a remote host, a daemon deployed and communicated with over JSON-RPC, with all critical protocol pitfalls addressed from day one
**Depends on**: Nothing (first phase)
**Requirements**: CONN-01, CONN-02, CONN-04, CONN-05, CONN-06, DAEM-01, DAEM-02, DAEM-03, DAEM-04, DAEM-05, DAEM-06
**Success Criteria** (what must be TRUE):
  1. An SSH connection can be established to a remote host using a private key, and the connection config is persisted in SQLite
  2. The ccud daemon is automatically deployed to the remote host via SFTP on first connect, and its version is checked and updated on subsequent connects
  3. JSON-RPC requests sent over SSH stdio receive correct responses from the daemon, with proper message framing that handles chunked streams
  4. Orphan daemon processes are cleaned up on disconnect (PID file, stdin EOF detection), and dropped connections trigger automatic reconnection with exponential backoff
  5. Host configurations can be created, edited, deleted, and connectivity tested before saving
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Database schema, constants, host CRUD REST API with connectivity test
- [x] 01-02-PLAN.md — Daemon (ccud) skeleton with JSON-RPC transport and esbuild bundle pipeline
- [x] 01-03-PLAN.md — Server-side SSHTransport framing and SFTP daemon deployer
- [x] 01-04-PLAN.md — Connection manager state machine with reconnection and lifecycle orchestration

### Phase 2: Abstraction & Core Remote Operations
**Goal**: Existing local project features continue working unchanged, and remote file browsing, file editing, and terminal sessions work through the same ProjectOperations code paths
**Depends on**: Phase 1
**Requirements**: ABS-01, ABS-02, ABS-03, ABS-04, ABS-05, FS-01, FS-02, FS-03, FS-04, TERM-01, TERM-02, TERM-03
**Success Criteria** (what must be TRUE):
  1. All existing local project functionality (file browsing, editing, terminal, git, chat) continues working identically after the route migration to ProjectOperations
  2. A remote project's file tree can be browsed, and files can be opened, edited, saved, created, renamed, and deleted through the same UI code paths as local
  3. A remote terminal session with full PTY support can be opened, resized, and multiple simultaneous sessions maintained
  4. The ProjectOperations interface cleanly abstracts local vs remote for filesystem, git, and terminal operations, with async-first design and proper error handling
**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md — ProjectOperations interface, LocalOperations, and project-resolver
- [x] 02-02-PLAN.md — Daemon filesystem handler implementation (all 8 RPC methods)
- [x] 02-03-PLAN.md — RemoteOperations + route migration to ProjectOperations
- [x] 02-04-PLAN.md — Remote terminal via ssh2 shell channels

### Phase 3: Full Feature Parity
**Goal**: Remote projects have complete feature parity with local projects -- git panel, AI chat, file watching, and resilient reconnection all work over SSH
**Depends on**: Phase 2
**Requirements**: FS-05, GIT-01, GIT-02, GIT-03, GIT-04, GIT-05, CHAT-01, CHAT-02, CHAT-03, CHAT-04
**Success Criteria** (what must be TRUE):
  1. The git panel shows status, diff, and log for remote projects, and the user can stage, unstage, commit, discard, branch, push, and pull -- identically to local
  2. A Claude Code session can be started on the remote host, streaming messages in the same NormalizedMessage format, with the same tool approval flow and session resume as local
  3. Remote file tree auto-updates when files change on the remote host via daemon file watching
  4. After an SSH connection drop, the session reconnects and restores working state (file tree refreshes, terminals reconnect, pending operations recover or fail cleanly)
**Plans:** 5 plans

Plans:
- [ ] 03-01-PLAN.md — Daemon git/exec handler + shared git parser extraction
- [x] 03-02-PLAN.md — Daemon file watcher with chokidar + watch RPC methods
- [ ] 03-03-PLAN.md — LocalOperations/RemoteOperations git methods + route migration
- [ ] 03-04-PLAN.md — Remote Claude CLI chat via daemon + NormalizedMessage translation
- [ ] 03-05-PLAN.md — File watch relay to frontend + reconnection state recovery

### Phase 4: Frontend Integration
**Goal**: Users can discover, create, and manage remote projects through the UI with clear visual distinction and the same polish as local projects
**Depends on**: Phase 3
**Requirements**: CONN-03, UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. The project creation wizard offers an "Add Remote Project" option that collects SSH config, tests the connection, and lets the user select a remote directory
  2. Remote projects appear in the sidebar alongside local projects with a clear visual distinction (icon or badge)
  3. Each remote project shows its connection status (connected, connecting, reconnecting, disconnected, error) and Taskmaster UI elements are hidden
  4. All remote-specific UI strings are present in i18n translation files for all supported languages
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Protocol & Connection Foundation | 4/4 | Complete | 2026-04-02 |
| 2. Abstraction & Core Remote Operations | 4/4 | Complete | 2026-04-02 |
| 3. Full Feature Parity | 0/5 | In Progress | - |
| 4. Frontend Integration | 0/0 | Not started | - |
