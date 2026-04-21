---
kind: agent-hook
trigger: on-save
scope: src/**/*.{ts,tsx}, api/**/*.ts
---

# Pre-commit typecheck

When a TypeScript file in `src/` or `api/` is saved, run the workspace
typecheck via `npx tsc -b --noEmit` and surface any errors inline. Fail
fast on:

- Unused imports or variables (TS6133)
- Mismatched prop types at component boundaries
- Missing return statements in `async` handlers

On a clean typecheck, silently pass. On failure, quote the offending
line and file path in the agent response so the user can one-click
jump to the diagnostic.

## Why

STADIUM is a real-time audio app with hot-reloading dev ergonomics —
by the time a TypeScript error surfaces in the browser, the broadcast
state has already been mutated. The hook catches the error at the
edit, before it reaches the running session.
