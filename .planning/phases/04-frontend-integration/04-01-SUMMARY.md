---
phase: 04-frontend-integration
plan: 01
subsystem: ui
tags: [remote, ssh, i18n, api, typescript, wizard]

# Dependency graph
requires:
  - phase: 03-remote-operations
    provides: SSH connection manager, remote-connections routes, project-resolver
provides:
  - Remote utility functions (isRemoteProject, extractHostId, extractRemotePath)
  - Extended WizardFormState with 8 remote fields and 'remote' WorkspaceType
  - api.remoteHosts namespace with 8 API methods
  - GET /:id/browse endpoint for remote directory listing
  - POST /:id/add-project endpoint for remote project registration
  - i18n translations for remote wizard and sidebar in 6 languages
affects: [04-02, 04-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [remote: prefix convention mirrored from server to frontend, English placeholder pattern for i18n]

key-files:
  created:
    - src/utils/remote.ts
  modified:
    - src/components/project-creation-wizard/types.ts
    - src/components/project-creation-wizard/ProjectCreationWizard.tsx
    - src/utils/api.js
    - server/routes/remote-connections.js
    - src/i18n/locales/en/common.json
    - src/i18n/locales/en/sidebar.json
    - src/i18n/locales/de/common.json
    - src/i18n/locales/de/sidebar.json
    - src/i18n/locales/ko/common.json
    - src/i18n/locales/ko/sidebar.json
    - src/i18n/locales/ja/common.json
    - src/i18n/locales/ja/sidebar.json
    - src/i18n/locales/ru/common.json
    - src/i18n/locales/ru/sidebar.json
    - src/i18n/locales/zh-CN/common.json
    - src/i18n/locales/zh-CN/sidebar.json

key-decisions:
  - "add-project endpoint bypasses addProjectManually (which calls fs.access) and directly uses loadProjectConfig/saveProjectConfig for remote paths"
  - "initialFormState in ProjectCreationWizard.tsx updated with default remote field values to prevent TypeScript errors"

patterns-established:
  - "Remote project config entries include isRemote: true and hostId fields for downstream identification"
  - "English placeholder values used for all non-English i18n keys (acceptable for v1)"

requirements-completed: [UI-05]

# Metrics
duration: 7min
completed: 2026-04-02
---

# Phase 04 Plan 01: Shared Foundation for Remote Frontend Summary

**Remote utility functions, wizard type extensions, 2 server endpoints, 8 API methods, and 12 i18n file updates establishing the contract layer for Plans 02 and 03**

## Task Results

### Task 1: Create remote utilities, extend wizard types, and add API methods
- **Commit:** b15fa77
- Created `src/utils/remote.ts` with three named exports: `isRemoteProject`, `extractHostId`, `extractRemotePath`
- Extended `WorkspaceType` to include `'remote'` as a third option
- Added 8 remote-specific fields to `WizardFormState` (remoteHostName, remoteHostname, remotePort, remoteUsername, remotePrivateKeyPath, remoteHostId, remoteConnectionTested, remotePath)
- Added `remoteHosts` namespace to `api` object with 8 methods (list, create, test, connect, status, disconnect, browse, addProject)
- Updated `initialFormState` with default remote field values

### Task 2: Add server browse/add-project endpoints and all i18n translations
- **Commit:** f6821b9
- Added `GET /:id/browse` endpoint that queries remote filesystem via `fs/readdir` RPC and filters to directories only
- Added `POST /:id/add-project` endpoint that directly writes to project config (bypassing `addProjectManually` which calls `fs.access` on local paths)
- Added remote wizard keys to `common.json` for all 6 languages: `step1.remote`, `step2.remote`, `step3.remote`, `buttons.addRemoteProject`, and 5 error keys
- Added `connectionStatus` (8 states) and `projects.remoteProject` to `sidebar.json` for all 6 languages

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Updated initialFormState with remote field defaults**
- **Found during:** Task 1
- **Issue:** WizardFormState type was extended with 8 new required fields but `initialFormState` in `ProjectCreationWizard.tsx` did not include them, which would cause TypeScript errors
- **Fix:** Added default values for all remote fields (empty strings, port 22, false for boolean)
- **Files modified:** `src/components/project-creation-wizard/ProjectCreationWizard.tsx`
- **Commit:** b15fa77

## Verification Results

- TypeScript compilation: PASSED (no errors)
- ESLint: PASSED (no errors on modified src/ files)
- Server module syntax: PASSED
- All 12 i18n files: valid JSON
- All acceptance criteria grep checks: PASSED

## Self-Check: PASSED
