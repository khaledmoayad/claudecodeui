---
phase: 03-full-feature-parity
plan: 05
subsystem: api
tags: [websocket, file-watching, ssh, reconnection, json-rpc]

# Dependency graph
requires:
  - phase: 03-02
    provides: daemon file watch handler (watch/start, watch/stop RPCs, watch/change notifications)
  - phase: 03-03
    provides: remote operations and ProjectOperations abstraction for remote file tree
  - phase: 03-04
    provides: remote Claude chat wiring in server/index.js
provides:
  - Remote file watch relay from daemon to frontend WebSocket clients
  - Reconnection state recovery (watchers re-established after SSH reconnection)
  - Frontend notification events (file_tree_updated, remote_reconnected, remote_disconnected)
affects: [04-frontend-ui, file-tree-component, connection-status-indicator]

# Tech tracking
tech-stack:
  added: []
  patterns: [factory-pattern-with-lifecycle-hooks, event-driven-reconnection-recovery]

key-files:
  created: []
  modified:
    - server/index.js
    - server/remote/connection-manager.js
    - server/routes/remote-connections.js

key-decisions:
  - "Factory pattern for remote-connections router to enable lifecycle hook injection from monolith"
  - "Watched paths preserved across reconnection (only notification listeners rebuilt) for seamless recovery"

patterns-established:
  - "Factory router pattern: routes that need lifecycle hooks export a factory function accepting callbacks"
  - "Per-host watch tracking: Maps keyed by hostId for watched paths and cleanup functions"

requirements-completed: [FS-05, GIT-05, CHAT-04]

# Metrics
duration: 4min
completed: 2026-04-02
---

# Phase 03 Plan 05: File Watch Relay and Reconnection Recovery Summary

**Daemon file watch notifications relayed to frontend WebSocket with per-host tracking and automatic reconnection recovery**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T19:17:13Z
- **Completed:** 2026-04-02T19:21:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Daemon watch/change notifications are now relayed to all connected frontend WebSocket clients as file_tree_updated messages
- SSH reconnection triggers automatic re-establishment of file watchers on the new daemon instance
- Frontend receives remote_reconnected and remote_disconnected WebSocket events for connection state awareness
- Watched paths tracked per host survive reconnection (only notification listeners are rebuilt)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire daemon file watch notifications to frontend WebSocket** - `768cf15` (feat)
2. **Task 2: Implement reconnection state recovery in connection manager** - `fb9f684` (feat)

## Files Created/Modified
- `server/index.js` - Added remoteWatchedPaths/remoteWatchCleanups Maps, setupRemoteFileWatch, stopRemoteFileWatch, reestablishRemoteWatches functions, reconnection/disconnect event handlers, file tree route integration
- `server/remote/connection-manager.js` - Added 'reconnected' event emission after successful SSH reconnection
- `server/routes/remote-connections.js` - Converted to factory pattern with onConnectionCreated lifecycle hook

## Decisions Made
- Converted remote-connections.js from a static router export to a factory function pattern (createRemoteConnectionRoutes) so server/index.js can inject lifecycle hooks for reconnection and disconnect handling without circular imports
- Watched paths are preserved across reconnection (remoteWatchedPaths Map not cleared on disconnect) so re-establishment can re-register all previously watched paths on the new daemon instance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Converted remote-connections.js to factory pattern**
- **Found during:** Task 2 (reconnection state recovery)
- **Issue:** Plan specified attaching reconnected/state listeners in server/index.js, but createConnection lives in remote-connections.js. Cannot import functions from the monolith into routes (circular dependency).
- **Fix:** Converted remote-connections.js default export from a static router to a factory function that accepts an onConnectionCreated callback, allowing server/index.js to inject lifecycle hooks when mounting routes.
- **Files modified:** server/routes/remote-connections.js, server/index.js
- **Verification:** Syntax check passes, all grep verification checks pass
- **Committed in:** fb9f684 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Factory pattern change was necessary to avoid circular dependency. No scope creep -- same functionality, cleaner wiring.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- File watching and reconnection recovery are complete for Phase 03
- Phase 04 (Frontend UI) can implement: file tree auto-refresh on file_tree_updated events, connection status indicator reacting to remote_reconnected/remote_disconnected events
- All backend infrastructure for remote SSH projects is now in place

---
## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 03-full-feature-parity*
*Completed: 2026-04-02*
