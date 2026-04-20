# STADIUM — Requirements

Spec-driven development. Acceptance criteria in EARS notation. These were
written first; `design.md` is the plan that satisfies them; `tasks.md` is
the sequence of implementation steps.

## User roles

- **Athlete (primary):** holds a phone while walking, running, or biking.
  Cannot look at the screen for more than half a second at a time.
  Wearing earbuds.
- **Viewer (secondary):** sees the athlete's short video clip on a social
  feed. Must understand what's happening from the HUD alone in under 2
  seconds.

## User stories

> **As an athlete**, I want a live AI sports broadcast of my walk / run /
> ride, so that I can film a viral 30-second video of my everyday
> activity feeling like a championship event.

> **As an athlete**, I want to be able to shout things into my collar mic
> and have the commentator react to them, so the broadcast feels like it
> knows I'm there.

> **As an athlete**, I want to export a photo-finish card from the live
> session, so I have a ready-made asset to post alongside the video.

> **As a viewer**, I want the on-screen HUD to clearly communicate
> athlete name, distance, time, pace, and current commentary, so the
> clip reads without audio.

## EARS requirements

### Broadcast loop

- **R1.** When the athlete taps **GO**, the system shall acquire a screen
  wake lock, request motion and microphone permissions, play a live crowd
  bed within 2 seconds, and produce its first play-by-play line within
  4 seconds.
- **R2.** While the athlete is moving, the system shall emit a new
  commentary line at least once every 60 seconds at hype level 1 and at
  least once every 22 seconds at hype level 5, so long as a prior line
  is not still being spoken.
- **R3.** When the athlete's pace increases by >2.5 km/h and exceeds
  8 km/h, the system shall trigger an urgency-3 "pace surge" line within
  the next tick (≤1.5 s).
- **R4.** When the athlete completes each whole kilometre, the system
  shall trigger an urgency-3 "milestone" line referencing that kilometre
  number.
- **R5.** When the athlete's speech-recognition layer emits a final
  transcript, the system shall quote it verbatim (truncated to 140 chars)
  in the next line, unless a prior line fired <6 seconds ago.
- **R6.** While the session is live, the system shall rotate the
  interlude pool so that at least one in every seven emitted lines is a
  "surroundings", "weather", or "ad-break" flavour line rather than a
  pace/check-in comment.

### HUD

- **R7.** The live HUD shall display, at all times while on-air, the
  athlete name, elapsed time, distance, instantaneous pace, and a hype
  score in the range 0–100.
- **R8.** The HUD shall visibly change (scoreboard accent color + hype
  meter animation) in direct response to pace changes, without the
  athlete needing to interact with the screen.
- **R9.** On any urgency-3 line, the system shall render a brief
  (<0.6 s) full-screen radial flash so that short video clips show clear
  "big moment" cues.

### Audio stack

- **R10.** The commentary layer, crowd-bed layer, and (when available)
  music-bed layer shall play simultaneously, with crowd at ~0.22 volume,
  music at ~0.18 volume, and commentary at full volume, so the speech
  remains intelligible while the bed provides atmosphere.
- **R11.** The music bed shall fade in over 2.5 seconds after it becomes
  ready, and shall fade out over 0.5 seconds on stop.

### Fallbacks

- **R12.** If no API key is configured, the system shall still run the
  full broadcast loop using the browser's `speechSynthesis` for the
  commentary and a procedural pink-noise bed for the crowd.
- **R13.** If a configured key is rejected mid-session, the system shall
  fall back to `speechSynthesis` for the current line, surface a visible
  error banner, and keep the broadcast alive.
- **R14.** If the Web Speech API is not available, the system shall
  continue to function without microphone-driven lines.

### Sharing

- **R15.** The live HUD shall expose a **photo finish** action that
  renders the current athlete / distance / time / pace / hype / last line
  into a 1080×1920 PNG.
- **R16.** The photo-finish action shall hand the PNG to
  `navigator.share` when the browser supports file shares, and fall back
  to a download when it does not.

### Privacy

- **R17.** The API key shall only ever be read from `localStorage` or a
  build-time `VITE_*` env var, and shall never be transmitted to a
  first-party server.
- **R18.** The microphone transcript shall be used only to produce the
  next commentary line and shall not be persisted across sessions.
