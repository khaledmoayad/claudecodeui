---
phase: 02-abstraction-core-remote-operations
plan: 04
subsystem: terminal
tags: [ssh2, pty, websocket, shell, remote-terminal]

# Dependency graph
requires:
  - phase: 02-abstraction-core-remote-operations (plan 01)
    provides: SSHConnectionManager, getConnection, project-resolver
provides:
  - Public client getter on SSHConnectionManager for shell/sftp channel creation
  - Remote terminal sessions via ssh2 shell channels in handleShellConnection
  - Session caching and reconnection for remote terminals (30-minute timeout)
affects: [phase-04-frontend, remote-terminal-ui, connection-status]

# Tech tracking
tech-stack:
  added: []
  patterns: [ssh2-shell-channels, resize-argument-swap, remote-session-key-prefix]

key-files:
  created: []
  modified:
    - server/remote/connection-manager.js
    - server/index.js

key-decisions:
  - "Remote detection via data.hostId instead of resolveProject -- terminal flow is direct, no project resolution needed"
  - "Resize argument swap in wrapper: external API uses (cols, rows) but ssh2 setWindow takes (rows, cols, height, width)"
  - "Added pty property to remote cached sessions for compatibility with existing cleanup handler"

patterns-established:
  - "Remote session key format: remote:{hostId}:{sessionId} -- separates from local keys"
  - "Shell wrapper pattern: write/resize/kill interface compatible with node-pty for unified handling"

requirements-completed: [TERM-01, TERM-02, TERM-03]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 02 Plan 04: Remote Terminal Support Summary

**Remote terminal sessions via ssh2 shell channels with correct resize argument order and 30-minute session caching**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T09:15:02Z
- **Completed:** 2026-04-02T09:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added public `client` getter to SSHConnectionManager exposing raw ssh2 Client for shell/sftp channel creation
- Extended handleShellConnection to detect remote projects via `data.hostId` and open ssh2 shell channels
- Implemented correct resize argument swap (cols, rows -> rows, cols for ssh2 setWindow)
- Remote session caching in ptySessionsMap with `remote:` key prefix and 30-minute timeout
- Session reconnection with output buffer replay for remote terminals
- All existing local PTY terminal behavior remains completely unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add public client getter to SSHConnectionManager** - `9463811` (feat)
2. **Task 2: Extend handleShellConnection for remote terminal sessions via ssh2 shell** - `918fc31` (feat)

## Files Created/Modified
- `server/remote/connection-manager.js` - Added `get client()` getter returning raw ssh2 Client or null
- `server/index.js` - Added getConnection import, remote shell detection, ssh2 shell channel handling, session caching, stream cleanup

## Decisions Made
- Used `data.hostId` for remote detection instead of `resolveProject` -- terminal flow receives hostId directly from frontend, no project name resolution needed
- Wrapped ssh2 stream in a shellProcess-compatible object with write/resize/kill methods so existing input and resize handlers work unchanged for both local and remote
- Added both `process` and `pty` properties to cached remote sessions for compatibility with existing cleanup timeout handler that references `session.pty.kill()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added pty property to remote cached session**
- **Found during:** Task 2
- **Issue:** The existing cleanup timeout handler at ws.on('close') calls `session.pty.kill()` -- remote sessions cached without `pty` property would fail silently during cleanup
- **Fix:** Added `pty: shellProcess` alongside `process: shellProcess` in the cached session object
- **Files modified:** server/index.js
- **Verification:** Cleanup handler's `session.pty && session.pty.kill` check works for both local and remote sessions
- **Committed in:** 918fc31 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added timeoutId clearing on remote reconnect**
- **Found during:** Task 2
- **Issue:** Plan's reconnect code didn't clear pending timeout -- a reconnected remote session could be killed by a stale timeout
- **Fix:** Added `clearTimeout(existingRemoteSession.timeoutId)` and set it to null on reconnect
- **Files modified:** server/index.js
- **Verification:** Reconnected sessions no longer have orphaned timeouts
- **Committed in:** 918fc31 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Remote terminal backend is complete -- ready for frontend wiring (Phase 4)
- Frontend needs to send `hostId` in WebSocket init message for remote projects
- Connection status indicator (CONN-03) in Phase 4 will show remote terminal state

---
*Phase: 02-abstraction-core-remote-operations*
*Completed: 2026-04-02*
