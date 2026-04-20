# STADIUM — Spec

Spec-driven development doc. Requirements → Design → Tasks, following Kiro's
three-phase flow. Acceptance criteria use EARS-style phrasing.

## 1. Problem

Running, walking, and biking are lonely. Runners already self-narrate internally
("I'm kicking now, nothing can stop me, WAIT is that a puddle — "). ElevenLabs'
audio models can do that out loud, in the voice of a professional broadcaster,
reacting to real signals from the runner's phone, for the price of a data
connection.

## 2. Users

- **Athlete (primary):** wants their run to feel like a main event, wants a
  clip they can post. Holds the phone while moving; cannot look at it for more
  than half a second at a time.
- **Viewer (secondary):** sees the athlete's clip on X / TikTok / Instagram.
  Needs to understand what's happening from the HUD alone.

## 3. Requirements (EARS)

### 3.1 Broadcast loop
- **R1.** When the athlete taps **GO**, the system shall request motion and
  microphone permissions, play a live crowd bed within 2 seconds, and produce
  its first play-by-play line within 4 seconds.
- **R2.** While the athlete is moving, the system shall emit a new commentary
  line at least once every 60 seconds at hype level 1 and at least once every
  22 seconds at hype level 5, so long as a prior line is not still being spoken.
- **R3.** When the athlete's pace increases by >2.5 km/h and exceeds 8 km/h,
  the system shall trigger a high-urgency "pace surge" line within the next
  tick (≤1.5s).
- **R4.** When the athlete completes each whole kilometre, the system shall
  trigger a high-urgency "milestone" line referencing that kilometre number.
- **R5.** When the athlete's speech-recognition layer emits a final transcript,
  the system shall quote it verbatim (truncated to 140 chars) in the next line,
  unless the last line fired <6 seconds ago.

### 3.2 HUD
- **R6.** The live HUD shall display, at all times while on-air: athlete name,
  elapsed time, distance, instantaneous pace, and a hype score in 0–100.
- **R7.** The HUD shall visibly change (scoreboard color accent + hype meter
  growth) in direct response to pace changes, without the athlete needing to
  interact.
- **R8.** On any urgency-3 line, the system shall render a short (<0.6s) full
  screen radial flash so that short camera clips show clear "big moment" cues.

### 3.3 Offline & no-key fallbacks
- **R9.** If no ElevenLabs API key is configured, the system shall still run
  the full broadcast loop using the browser's `speechSynthesis` for the voice
  and a procedural pink-noise bed for the crowd, so users can evaluate the app
  without a paid account.
- **R10.** If the Web Speech API is not available, the system shall continue to
  function without microphone-driven lines.

### 3.4 Privacy
- **R11.** The ElevenLabs API key shall be stored only in the browser's
  `localStorage` and shall never be transmitted to a first-party server
  belonging to this project.

## 4. Design decisions

- **Browser-only, no backend.** The hackathon submission is a static site. The
  athlete provides their own ElevenLabs key, calls the ElevenLabs REST API
  directly, and owns their own usage.
- **Pure decision engine.** `lib/commentary.ts#decide(state, signal)` is a
  deterministic pure function. This keeps the behavior under R1–R5 testable,
  and leaves room to swap in an LLM-driven generator later without changing
  the rest of the app.
- **Crowd bed cached once per session.** The SFX generation endpoint is
  metered; re-fetching the crowd loop every 12 seconds would be wasteful and
  would create seams. We fetch once at `start()` and loop the returned audio.
- **Data-URL fallback instead of bundled MP3.** Shipping a baked-in stadium
  loop would make the bundle big and create licensing questions; a procedural
  pink-noise bed is tiny, free, and clearly flagged as "demo mode".
- **No AnimatePresence on the landing↔live swap.** Exit animations were
  blocking the live tree from mounting on cold start; a straight conditional
  plus per-branch `initial/animate` produces the same visual effect without
  the coordination overhead.

## 5. Task breakdown (Kiro task list)

1. Scaffold Vite + React-TS, wire Tailwind v4, set mobile viewport + safe-area.
2. Broadcast theme tokens (blaze / volt / chalk / ink) + grain + scanline CSS.
3. `lib/elevenlabs.ts` — REST client for TTS, SFX, voices, key verification.
4. `lib/motion.ts` — GPS watch + DeviceMotion + simulate() for desktop testing.
5. `lib/speech.ts` — Web Speech API wrapper with auto-restart + graceful absence.
6. `lib/commentary.ts` — pure `decide()` engine + builders for every trigger.
7. `lib/ambient.ts` — crowd bed loader (SFX when key available, pink noise when not).
8. `hooks/useBroadcast.ts` — orchestration: tick loop, speak queue, history.
9. Components: Scoreboard, CaptionStream, SessionLog, HypeMeter, FlashOverlay,
   SettingsSheet, BroadcastButton, Ticker.
10. Landing page (hero + ticker + pillars) and settings sheet (key verify).
11. Recursive mobile testing in Chrome with 430×900 viewport.
12. Polish pass: hype meter, session log, flash overlay, `LINE HYPE` force button.

## 6. Open work (post-hackathon)

- Record the whole broadcast (ambient + commentary) via `MediaRecorder` piped
  through a Web Audio graph, export a share-ready MP3/MP4.
- ElevenLabs Conversational AI (Convai) mode that keeps context across the
  whole run and reacts to mic input with real dialog.
- Generative music bed from ElevenLabs Music API, beat-matched to pace bands.
- "Photo finish" share card: current HUD + last line rendered to a PNG.
