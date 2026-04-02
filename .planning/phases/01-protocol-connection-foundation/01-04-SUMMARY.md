---
phase: 01-protocol-connection-foundation
plan: 04
subsystem: api
tags: [ssh2, connection-manager, state-machine, reconnection, express, rest-api]

# Dependency graph
requires:
  - phase: 01-protocol-connection-foundation (plans 01, 02, 03)
    provides: constants, remote-hosts-db, deployer, SSHTransport
provides:
  - SSHConnectionManager class with full lifecycle state machine
  - Module-level connection tracking (create/get/remove/getAll)
  - REST API endpoints for connect, disconnect, status, and list connections
affects: [02-abstraction-core-remote, 03-operations, 04-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [EventEmitter state machine, exponential backoff with jitter, fire-and-forget async connect]

key-files:
  created:
    - server/remote/connection-manager.js
    - server/routes/remote-connections.js
  modified:
    - server/index.js

key-decisions:
  - "No static testConnection on SSHConnectionManager -- SSH test is handled by existing routes in Plan 01-01 to avoid divergence"
  - "connect() is fire-and-forget from the API (202 Accepted) -- state events propagate progress to consumers"
  - "Both routers mounted on /api/remote-hosts with unique sub-paths, no conflicts"

patterns-established:
  - "State machine pattern: EventEmitter emits 'state' events with { state, previousState, detail }"
  - "Connection tracking via module-level Map with create/get/remove/getAll factory functions"
  - "Pre-connect cleanup: kill existing daemon via PID file before re-deploying"

requirements-completed: [CONN-04, DAEM-06, CONN-02]

# Metrics
duration: 7min
completed: 2026-04-02
---

# Phase 01 Plan 04: Connection Manager and API Summary

**SSH connection manager with 8-state lifecycle, exponential backoff reconnection, daemon deployment orchestration, and REST API endpoints for connect/disconnect/status**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-01T23:59:00Z
- **Completed:** 2026-04-02T00:06:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- SSHConnectionManager orchestrating full lifecycle: connecting -> deploying -> initializing -> ready with automatic reconnection
- Exponential backoff reconnection with 1s base, 30s max, 2s jitter, 10 max attempts before permanent failure
- Pre-connect daemon cleanup (kill via PID file), protocol version handshake with auto-redeploy on mismatch
- REST API endpoints wired: POST /:id/connect (202), POST /:id/disconnect, GET /:id/status, GET /connections

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SSHConnectionManager with full state machine, deployment, and reconnection** - `46a62cd` (feat)
2. **Task 2: Create connect/disconnect/status API routes and mount in server** - `7e77de0` (feat)

## Files Created/Modified

- `server/remote/connection-manager.js` - SSHConnectionManager class with state machine, reconnection, module-level connection tracking (420 lines)
- `server/routes/remote-connections.js` - Express router for connect, disconnect, status, and list connections endpoints (102 lines)
- `server/index.js` - Added import and mount for remoteConnectionRoutes at /api/remote-hosts

## Decisions Made

- No static testConnection on SSHConnectionManager -- testing is handled by Plan 01-01 routes to avoid two divergent implementations
- connect() returns 202 (Accepted) and runs lifecycle asynchronously -- state events handle progress notification
- Both remote-hosts and remote-connections routers mount on /api/remote-hosts with unique sub-paths (no conflicts)
- Protocol version mismatch triggers one forced re-deploy attempt before failing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- node_modules not present in worktree -- resolved by symlinking from main repo and rebuilding native modules (better-sqlite3)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 1 modules are implemented: constants, database schema, daemon source, build pipeline, transport, deployer, connection manager, and API routes
- The full connection lifecycle is wired end-to-end: database -> routes -> connection-manager -> deployer -> transport -> daemon
- Ready for Phase 2 (abstraction and core remote operations) to build on this foundation

## Self-Check: PASSED

- server/remote/connection-manager.js: FOUND
- server/routes/remote-connections.js: FOUND
- Commit 46a62cd: FOUND
- Commit 7e77de0: FOUND

---
*Phase: 01-protocol-connection-foundation*
*Completed: 2026-04-02*
