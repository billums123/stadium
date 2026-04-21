# Session Recap — Design

Satisfies [`requirements.md`](./requirements.md). Implementation lives
in a future commit driven by a Kiro agent session against this file;
tasks in [`tasks.md`](./tasks.md).

## 1. Phase model change

Current `BroadcastPhase` is `"idle" | "warming" | "live" | "stopping"`.
Add `"recap"`:

```ts
type BroadcastPhase = "idle" | "warming" | "live" | "stopping" | "recap";
```

- `stop()` transitions `live → stopping → recap` when the session
  crossed either threshold (R1).
- A dismissible `"NEW BROADCAST"` action transitions `recap → idle`,
  clearing `goalProgress` and resetting the director (R3).

## 2. Where the numbers come from

The live tick already exposes `motion.elapsedMs`, `motion.distanceMeters`
and `motion.paceKmh`; they freeze the moment the tracker stops. For
R4–R6 we need three additional rollups:

- **Peak pace** — `peakKmhRef` already exists, just lift it into
  `BroadcastStatus.recap`.
- **Hype peak** — add `peakHypeRef`, bumped alongside `setPartial({ hypeScore })`
  wherever that happens today.
- **Average pace** — computed on transition into recap:
  `(distanceMeters / elapsedMs) * 3.6`.

## 3. New status shape

```ts
type RecapSnapshot = {
  athleteName: string;
  totalTimeMs: number;
  totalDistanceM: number;
  peakKmh: number;
  avgKmh: number;
  peakHype: number;
  goalOutcome: "complete" | "failed" | "none";
  closingLine: Line | null;
};

// BroadcastStatus gains:
recap: RecapSnapshot | null;
```

## 4. Closing-line generation

New director event: `session-recap`. Prompt building lives in
`director.ts#buildRecapPrompts()` and pulls a new signal:

```ts
type RecapSignal = DirectorSignal & {
  outcome: "complete" | "failed" | "none";
  peakKmh: number;
  avgKmh: number;
  careerDelta: { sessionsAfter: number; lifetimeKmAfter: number };
};
```

Template fallback lines live in `commentary.ts#buildRecapLine(kind)`
with three kinds: `complete`, `failed`, `free-run`.

## 5. Recap UI

New component `components/RecapScreen.tsx` mounted at the top level of
`App.tsx` when `status.phase === "recap"`. Replaces the live HUD
tree, never the landing. Structure:

```
<RecapScreen status={status}>
  <HeroBar />          // "FINAL WHISTLE · NAME"
  <CoreStats />        // time · dist · avg pace
  <SecondaryStats />   // peak pace · peak hype · goal outcome
  <ClosingLine />      // the commentator's final word
  <Actions>
    <ShareButton />    // reuses shareCard() with the recap snapshot
    <NewBroadcast />   // returns to landing
  </Actions>
</RecapScreen>
```

### Share-card extension

`lib/sharecard.ts#shareCard` currently takes `{ athleteName, line,
motion, hypeScore }`. Extend with an optional `recap: RecapSnapshot`
branch that renders "FINAL WHISTLE" chrome instead of "LIVE · CH. 01".

## 6. Confetti + haptics on entry

Add a layout effect in `App.tsx` that fires `setConfettiTrigger`
exactly once when `status.phase` transitions to `"recap"` AND
`status.recap?.goalOutcome === "complete"`. Pair with
`haptic("success")`.

## 7. Career write-through

Move the `recordSession()` call out of `stop()` and into the
`stop → recap` transition inside `useBroadcast` — but keep the
`stop → idle` fallback for sessions too short to count (R1
thresholds), so those sessions don't pollute career stats.
