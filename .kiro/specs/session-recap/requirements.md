# Session Recap — Requirements

The broadcast needs a proper sign-off. When the athlete taps STOP, the
current UX dumps them back to the landing page with no acknowledgement
of what just happened. A post-session recap screen closes the loop:
summary stats, the commentator's final word, a one-tap share.

This spec is written first; implementation lives in a future commit
driven by a Kiro agent session against this file.

## User stories

> **As an athlete** who just finished a session, I want the broadcast
> to congratulate me with a specific, earned line — not a generic "see
> you next time" — and show me the numbers I hit, so the session feels
> like a real event that had an ending.

> **As an athlete** who just hit a goal, I want a visually distinctive
> "GOAL HIT" treatment on the recap (colors, confetti re-fire, haptic)
> so the recap itself becomes shareable, independent of any photo
> finish I took mid-run.

> **As a viewer** who sees the recap PNG on a feed, I want to read at
> a glance: who ran, how far, how fast, and whether they hit the goal.

## EARS requirements

### Recap lifecycle

- **R1.** When the athlete taps STOP during a live session, the system
  shall transition to a `recap` phase — not back to `landing` — for
  any session that covered ≥ 30 metres or ran for ≥ 20 seconds.
- **R2.** While in `recap` phase, the session clock and motion tracker
  shall remain stopped; the recap is read-only.
- **R3.** The athlete can dismiss the recap back to the landing with a
  dedicated "NEW BROADCAST" action; that action shall also reset the
  director, clear the goal progress, and primer-done state stays true.

### Stats displayed

- **R4.** The recap shall display: athlete name, total time, total
  distance, peak pace, average pace, hype peak (max intensity hit),
  and goal outcome when a goal was set.
- **R5.** Average pace shall be computed as `distance / elapsed`, not
  a running average of instantaneous pace readings, so GPS jitter
  doesn't inflate the number.
- **R6.** Hype peak shall be the highest `hypeScore` observed during
  the session, persisted on the broadcast status.

### The final word

- **R7.** On transition into `recap`, the system shall generate ONE
  closing commentary line through the same LLM path as live commentary,
  with a dedicated `session-recap` event.
- **R8.** The closing line's LLM prompt shall include: goal outcome
  (complete/failed/none), total distance, peak pace, career delta
  (sessions + 1, lifetime km + this session), so the line references
  concrete achievement instead of generic platitudes.
- **R9.** When the LLM call fails / times out, the system shall fall
  back to a template closing line — scripted variants for
  goal-complete, goal-failed, and free-run finishes.

### Sharing

- **R10.** The recap shall expose a prominent photo-finish export
  action (reusing `lib/sharecard.ts`) with the recap stats instead of
  the live HUD's running values.
- **R11.** When the goal was complete, the recap shall auto-fire the
  confetti burst exactly once on entry and haptic-success on mount.

### Persistence

- **R12.** The session shall be recorded into the `Career` object
  exactly once, on recap entry — not on phase=idle — so the career
  counter correctly reflects sessions the athlete actually saw a
  recap for.

## Out of scope

- Recap history / "last 10 sessions" view.
- Social-network account-linking / auto-post.
- Multi-athlete / leaderboard comparisons.
