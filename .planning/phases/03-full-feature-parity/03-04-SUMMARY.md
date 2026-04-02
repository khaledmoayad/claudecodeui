---
phase: 03-full-feature-parity
plan: 04
subsystem: api
tags: [claude-cli, json-rpc, websocket, stream-json, child_process, daemon]

requires:
  - phase: 01-protocol-connection-foundation
    provides: "SSH transport, daemon framework, JSON-RPC protocol"
  - phase: 02-abstraction-core-remote-operations
    provides: "ProjectOperations abstraction, connection manager, remote operations"
  - phase: 03-01
    provides: "Daemon git handler pattern"
  - phase: 03-02
    provides: "Daemon watch handler and dispatch pattern"
provides:
  - "Daemon Claude CLI session handler (claude/start, claude/input, claude/abort, claude/list-sessions)"
  - "Remote Claude chat integration in handleChatConnection WebSocket flow"
  - "CLI stream-json to NormalizedMessage translator"
  - "Remote permission prompt relay and response"
affects: [04-frontend-ui, remote-project-chat]

tech-stack:
  added: []
  patterns: ["Claude CLI --output-format stream-json parsing", "daemon notification relay to WebSocket", "hostId branching for remote vs local"]

key-files:
  created: ["ccud/src/handlers/claude.js"]
  modified: ["ccud/src/index.js", "server/index.js"]

key-decisions:
  - "Used child_process.spawn for Claude CLI (not execFile) to support long-running streaming sessions"
  - "CLI availability check via 'command -v claude' before spawning to provide clear error message"
  - "SIGTERM with 5s SIGKILL fallback for session abort to ensure cleanup"
  - "translateClaudeCliEvent maps all CLI event types to NormalizedMessage format inline in server/index.js"

patterns-established:
  - "hostId branching: all chat handlers check data.hostId to route remote vs local"
  - "Notification relay: daemon sends claude/output notifications, server translates to NormalizedMessage"
  - "Writer cleanup array: writer._remoteCleanups stores notification unsubscribe functions"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04]

duration: 3min
completed: 2026-04-02
---

# Phase 03 Plan 04: Remote Claude Chat Summary

**Claude CLI spawned on remote host via daemon with stream-json output translated to NormalizedMessage through existing WebSocket chat flow**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T13:40:42Z
- **Completed:** 2026-04-02T13:44:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Daemon can spawn, manage, and relay Claude CLI sessions on remote hosts
- Remote Claude chat integrates into existing handleChatConnection WebSocket flow via hostId branching
- All CLI output types (text, tool_use, thinking, tool_result, permission_request, exit) translated to NormalizedMessage
- Permission prompts relayed to frontend, responses sent back as stdin y/n to CLI
- Session abort and listing work for both local and remote contexts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create daemon Claude CLI handler** - `4a35fc2` (feat)
2. **Task 2: Wire remote Claude chat into handleChatConnection** - `8f6bebe` (feat)

## Files Created/Modified
- `ccud/src/handlers/claude.js` - Daemon handler for claude/start, claude/input, claude/abort, claude/list-sessions
- `ccud/src/index.js` - Added claude/* dispatch routing and cleanup
- `server/index.js` - Added handleRemoteClaudeCommand, translateClaudeCliEvent, hostId branching in chat handlers

## Decisions Made
- Used `spawn` (not `execFile`) for Claude CLI since sessions are long-running streaming processes
- Check CLI availability with `command -v claude` before spawning to provide actionable error message
- SIGTERM with 5-second SIGKILL fallback ensures cleanup of hung processes
- Placed `translateClaudeCliEvent` inline in server/index.js rather than a separate module to minimize file proliferation
- Permission responses use simple y/n stdin input matching Claude CLI's interactive prompt format

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Remote Claude chat sessions fully operational via daemon
- Frontend can now be wired to use hostId in claude-command messages for remote projects
- Permission prompt UI already handles permission_request NormalizedMessage kind

## Self-Check: PASSED

All files verified present, all commit hashes confirmed in git log.

---
*Phase: 03-full-feature-parity*
*Completed: 2026-04-02*
