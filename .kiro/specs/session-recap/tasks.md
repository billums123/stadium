# Session Recap — Tasks

Sequenced implementation plan for the spec in
[`requirements.md`](./requirements.md) / [`design.md`](./design.md).
Every task maps to one or more EARS requirements. All start as
`pending`; flip to `✅` as Kiro's agent completes them in-session.

| # | Task | Requirements | Status |
|---|---|---|---|
| 1 | Extend `BroadcastPhase` to include `"recap"`. Update every switch / conditional that exhausts phase values. | R1, R3 | ⬜ pending |
| 2 | Add `peakHypeRef` to `useBroadcast`; wire bumping alongside every `setPartial({ hypeScore })`. | R6 | ⬜ pending |
| 3 | Define `RecapSnapshot` type, add `recap: RecapSnapshot \| null` to `BroadcastStatus`, default `null`. | R4 | ⬜ pending |
| 4 | Add a `computeRecap(motion, peakKmh, peakHype, goal)` pure helper in `lib/recap.ts` with unit-test-friendly signature. | R4, R5 | ⬜ pending |
| 5 | Add `buildRecapLine(kind)` template variants (`complete` / `failed` / `free-run`) in `lib/commentary.ts`. At least 3 variants each. | R9 | ⬜ pending |
| 6 | Add `session-recap` event + `buildRecapPrompts()` to `lib/director.ts`; prompt includes outcome + peak + avg + career delta. | R7, R8 | ⬜ pending |
| 7 | Refactor `useBroadcast.stop()`: if session exceeded R1 thresholds, run `computeRecap`, generate closing line via LLM (fall back to template), persist recap into status, set phase `"recap"`. Else behave as today. | R1, R2, R7, R9, R12 | ⬜ pending |
| 8 | Move `recordSession()` call out of `stop()` and into the recap-entry branch. | R12 | ⬜ pending |
| 9 | Add `newBroadcast()` action on the hook: clears recap, resets director, transitions `recap → idle`. | R3 | ⬜ pending |
| 10 | Create `components/RecapScreen.tsx` with HeroBar / CoreStats / SecondaryStats / ClosingLine / Actions subcomponents. | R4 | ⬜ pending |
| 11 | Mount RecapScreen in `App.tsx` when `status.phase === "recap"`. Swap it against the live HUD, not the landing. | R1 | ⬜ pending |
| 12 | Extend `lib/sharecard.ts#shareCard` to accept an optional `recap: RecapSnapshot` and render "FINAL WHISTLE" chrome. | R10 | ⬜ pending |
| 13 | Layout-effect in App: fire confetti + success haptic exactly once when entering recap with goal complete. | R11 | ⬜ pending |
| 14 | Add 6+ vitest unit tests for `computeRecap` covering zero-distance, jitter handling, goal-complete/failed/none branches. | R4–R6 | ⬜ pending |
| 15 | End-to-end smoke: simulate a 45-second session with goal complete, assert recap appears with correct numbers and confetti fires. | R1, R11, R12 | ⬜ pending |

## How a Kiro session should approach this

1. Open this `tasks.md` and the sibling `design.md` / `requirements.md`.
2. Start with tasks 1–3 (type scaffolding) as a single vibe-coded
   commit — they're all pure shape changes.
3. Move to task 4 (the pure helper) — let Kiro write both the
   implementation AND the vitest unit tests in one pass, then iterate
   until the test suite passes.
4. Tasks 5–6 are pure template / prompt additions; batch into one
   commit.
5. Tasks 7–9 are the hook surgery — the load-bearing work. Do these
   one at a time with a test run between each.
6. Tasks 10–13 are UI; Kiro can propose the component shape from the
   design doc and iterate on it.
7. Task 14–15 close the loop. Flip every row above to ✅ as you go.

This sequence was chosen so Kiro can run unit tests after every
functional task — the feedback loop stays tight and the agent never
goes off in the weeds for more than ~100 lines at a time.
