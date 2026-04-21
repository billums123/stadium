# Session Recap — Tasks

Sequenced implementation plan for the spec in
[`requirements.md`](./requirements.md) / [`design.md`](./design.md).
Every task maps to one or more EARS requirements.

| # | Task | Requirements | Status |
|---|---|---|---|
| 1 | Extend `BroadcastPhase` to include `"recap"`. Update every switch / conditional that exhausts phase values. | R1, R3 | ✅ |
| 2 | Add `peakHypeRef` to `useBroadcast`; wire bumping alongside every `setPartial({ hypeScore })`. | R6 | ✅ |
| 3 | Define `RecapSnapshot` type, add `recap: RecapSnapshot \| null` to `BroadcastStatus`, default `null`. | R4 | ✅ |
| 4 | Add a `computeRecap(motion, peakKmh, peakHype, goal)` pure helper in `lib/recap.ts` with unit-test-friendly signature. | R4, R5 | ✅ |
| 5 | Add `buildRecapLine(kind)` template variants (`complete` / `failed` / `free-run`) in `lib/commentary.ts`. At least 3 variants each. | R9 | ✅ |
| 6 | Add `session-recap` event + `buildRecapPrompts()` to `lib/director.ts`; prompt includes outcome + peak + avg + career delta. | R7, R8 | ✅ |
| 7 | Refactor `useBroadcast.stop()`: if session exceeded R1 thresholds, run `computeRecap`, generate closing line via LLM (fall back to template), persist recap into status, set phase `"recap"`. Else behave as today. | R1, R2, R7, R9, R12 | ✅ |
| 8 | Move `recordSession()` call out of `stop()` and into the recap-entry branch. | R12 | ✅ |
| 9 | Add `newBroadcast()` action on the hook: clears recap, resets director, transitions `recap → idle`. | R3 | ✅ |
| 10 | Create `components/RecapScreen.tsx` with HeroBar / CoreStats / SecondaryStats / ClosingLine / Actions subcomponents. | R4 | ✅ |
| 11 | Mount RecapScreen in `App.tsx` when `status.phase === "recap"`. Swap it against the live HUD, not the landing. | R1 | ✅ |
| 12 | Extend `lib/sharecard.ts#shareCard` to accept an optional `recap: RecapSnapshot` and render "FINAL WHISTLE" chrome. | R10 | ✅ |
| 13 | Layout-effect in App: fire confetti + success haptic exactly once when entering recap with goal complete. | R11 | ✅ |
| 14 | Add 11 vitest unit tests for `computeRecap` / `isRecapWorthy` covering zero-distance, jitter handling, goal-complete/failed/none branches, name fallback. | R4–R6 | ✅ |
| 15 | End-to-end smoke: simulate a 45-second session with goal complete, assert recap appears with correct numbers and confetti fires. | R1, R11, R12 | ⬜ pending |

## Notes

- Task 15 (Playwright E2E) is deferred — the current `vitest run` suite
  covers the recap math end-to-end, and a Playwright harness would need
  audio / fake-timer plumbing that's out of scope for the initial
  ship.
- `vitest` + `jsdom` added as dev deps. `npm test` runs the suite; all
  11 unit tests pass on the shipped implementation.

## Verification

```
$ npm test
 RUN  v4.1.5
 Test Files  1 passed (1)
      Tests  11 passed (11)
```
