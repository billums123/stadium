# Agent notes

If you're an agent (Kiro, Claude, Copilot) picking up this project mid-flight,
read this first, then `.kiro/steering/*.md`, then the live spec in
`.kiro/specs/stadium/`.

## How this project is organised

The authoritative spec lives in `.kiro/specs/stadium/`:

- `requirements.md` — EARS-format acceptance criteria (R1–R18). Treat these
  as the source of truth; code and UI should trace back to them.
- `design.md` — architectural decisions with trade-off notes and the
  module map / state shapes / tick-loop walkthrough.
- `tasks.md` — sequenced implementation plan, current status, and the
  next two items to pick up.

Project-wide guardrails are in `.kiro/steering/`:

- `product.md` — scope, tone, what's explicitly out of scope.
- `tech.md` — stack, vendor contract, what conventions to follow and
  what to avoid reaching for.
- `structure.md` — file layout, naming, commit style.

## Working rules

1. **Spec first.** Before touching code, check if a requirement already
   covers the change. If yes, reference it (`// R3`) at the call site.
   If no, update `requirements.md` before implementation.
2. **Small, traceable commits.** One logical chunk per commit; the
   subject line should map cleanly to a row in `tasks.md`. Flip the task
   status column in the same commit that finishes the work.
3. **Refs over state inside the tick loop.** The broadcast tick runs
   every 1.5 s and reads via refs (`motionRef`, `transcriptRef`,
   `engineRef`, `speakingRef`). Don't close over React state from inside
   the interval callback.
4. **Pure engine.** `lib/commentary.ts#decide` must stay a pure function
   of `(EngineState, Signal, Line | null)`. Anything that wants side
   effects goes in `useBroadcast`.
5. **No new vendor dependencies** without updating the vendor contract
   in `.kiro/steering/tech.md` first.
6. **Cheese tax.** Commentary lines are reviewed for tone. Dry /
   observational > shouty / hype. When adding new lines, aim for the
   register of "a squirrel just witnessed pace" rather than "THE CROWD
   ERUPTS".

## Handy starting points

- Add a new commentary trigger: extend the `Trigger` union in
  `lib/commentary.ts`, write a `build<Name>(s: Signal): Line` helper,
  wire it into `decide()` or `pickFiller()`. Add a requirement row
  (R19+) and a corresponding task.
- Add a new HUD element: new component in `src/components/`, import in
  `src/App.tsx` under the `screen === "live"` branch. Remember the
  "PHOTO FINISH" canvas in `lib/sharecard.ts` must be kept visually
  aligned if the scoreboard grows a new stat.
- Swap the template engine for Convai: replace the body of `decide()`
  with a thin shim over the Convai WebSocket client; keep the pure
  signature so the call sites don't change.

## Before you commit

- `npm run build` passes.
- You've updated the `tasks.md` status column for the task you just
  finished.
- If you added a requirement, you traced it in the code with `// R{n}`.
- Commit body explains the *why*, not the *what*.
