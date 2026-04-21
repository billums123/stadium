---
kind: agent-hook
trigger: before-commit
scope: src/lib/commentary.ts, src/lib/director.ts, src/lib/goal.ts
---

# Requirement-trace guard

Every function in `src/lib/commentary.ts`, `src/lib/director.ts`, and
`src/lib/goal.ts` that implements a named requirement from
`.kiro/specs/stadium/requirements.md` should have a `// R{n}` trace
comment at the top, matching the requirement number.

## What the hook does

1. Parse `.kiro/specs/stadium/requirements.md` for all `R1..Rn` ids.
2. Walk the decision engine and goal-progress modules, pull their top-
   level function bodies.
3. For every function whose docstring references an event type or a
   trigger from the director table, assert that the body opens with a
   `// R{n}` trace comment.
4. Fail the pre-commit with a report of missing traces.

## Why

The spec is only load-bearing if the code points at it. The guard
keeps the trace comments from decaying into stale lies as the engine
evolves — either the trace exists and matches, or the commit fails.
