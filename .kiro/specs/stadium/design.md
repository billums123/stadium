# STADIUM — Design

The plan that satisfies [`requirements.md`](./requirements.md). Implementation
is tracked in [`tasks.md`](./tasks.md).

## 1. Architectural decisions

### 1.1 Browser-only, no backend

The product is a static Vite build. The athlete supplies their own API key
(or the operator bakes one into `VITE_ELEVENLABS_API_KEY` for a demo
deployment). Calls go directly from the browser to the audio vendor.

- **Why:** hackathon-scope shipping with zero infra; each athlete owns
  their own usage; no shared-secret blast radius.
- **Trade-off:** env-var keys end up in the client bundle, which is fine
  for a throwaway URL but unsuitable for a production launch. Upgrade
  path in §5.

### 1.2 Pure commentary engine

`lib/commentary.ts#decide(state, signal)` is a pure function. Given an
`EngineState` and a `Signal` snapshot (athlete name, motion, transcript
freshness, elapsed session time, hype level), it returns either `null`
(stay quiet) or `{ line, next }` with the line to speak and the engine
state to thread forward.

- **Why:** keeps behaviour under R1–R6 deterministic and testable without
  mocking audio. Makes it possible to swap in an LLM-driven generator
  later by replacing only this function.
- **Trade-off:** purely template-driven text becomes repetitive over long
  sessions; §5 lists Convai as the follow-up.

### 1.3 Three-layer audio, all on `HTMLAudioElement`

The session plays three independent `<audio>` streams in parallel:

1. **Crowd bed** — 12 s SFX loop, generated once per session, 0.22 volume.
2. **Music bed** — 30 s generative music, fetched in background,
   cross-faded in to 0.18 volume, looped.
3. **Commentary** — per-line TTS mp3 blobs, full volume, played serially.

- **Why:** using three plain `<audio>` elements avoids Web Audio graph
  complexity for a hackathon and is trivially interrupted on stop.
- **Trade-off:** no per-layer EQ or compression; if the athlete wants
  recorded output they'll need MediaRecorder piped through a Web Audio
  graph, which is §5 work.

### 1.4 Motion-first, LLM-free

`lib/motion.ts` reads GPS speed + `DeviceMotionEvent` acceleration and
exposes a `MotionState` updated at 4 Hz. For desktop demos there's a
`simulate(kmh)` injection path.

- **Why:** deterministic signals keep the decision engine pure, and keep
  the app working with no network after start-up.
- **Trade-off:** on iOS Safari, `DeviceMotionEvent.requestPermission`
  gates motion behind a user gesture (already handled in `start()`).

### 1.5 AnimatePresence-less screen swap

The landing → live screen switch is a plain conditional render on
`screen === "landing"`. Framer Motion still handles the per-branch
fade-in.

- **Why:** `AnimatePresence mode="wait"` was holding the live tree from
  mounting during the exit animation, producing an empty screen mid-
  transition. Cutting it fixed R7 (HUD visible at all times on-air).

### 1.6 Spec-driven development

Requirements were written before any code in this directory. Each commit
maps to one or more spec items — see `tasks.md`. The `.kiro/steering/`
docs are the project-wide guardrails the agent uses when extending.

## 2. Module map

```
src/
  App.tsx                         top-level screen + bottom nav
  main.tsx                        React root
  index.css                       design tokens + motion keyframes

  hooks/useBroadcast.ts           start/stop orchestration + tick loop

  lib/elevenlabs.ts               TTS + SFX + music + voices REST client
  lib/motion.ts                   GPS watch + accel + simulate()
  lib/speech.ts                   Web Speech API wrapper
  lib/commentary.ts               pure decide() engine + line builders
  lib/ambient.ts                  crowd & music bed loaders + fadeTo()
  lib/sharecard.ts                1080x1920 canvas photo finish + share
  lib/wakelock.ts                 screen wake lock handle
  lib/store.ts                    useSettings() hook (localStorage + env)

  components/
    Scoreboard.tsx                live HUD (athlete, stats, hype meter)
    CaptionStream.tsx             animated play-by-play card
    SessionLog.tsx                recent-lines history pane
    HypeMeter.tsx                 animated bar with color bands
    FlashOverlay.tsx              urgency-3 screen flash
    BroadcastButton.tsx           GO / STOP pulse button
    SettingsSheet.tsx             key entry + voice picker + hype slider
    Ticker.tsx                    marquee chyron strip
```

## 3. State shape

```ts
// commentary.ts
type EngineState = {
  hasOpened: boolean;
  lastTriggerAt: number;    // ms in session
  lastPace: number;
  lastKmAnnounced: number;
  cooldownMs: number;       // min gap between lines
  interludeCount: number;   // rotates surroundings/ad/weather
};

// useBroadcast.ts
type BroadcastStatus = {
  phase: "idle" | "warming" | "live" | "stopping";
  motion: MotionState;
  lastLine: Line | null;
  history: Line[];          // last 6 lines for the session log
  transcript: string;
  interim: string;
  speaking: boolean;
  hypeScore: number;        // 0-100
  error: string | null;
};
```

## 4. Tick loop

`useBroadcast` drives everything off a 1.5 s interval:

1. Read latest `motionRef.current` + `transcriptRef.current`.
2. Build the `Signal` (athlete, motion, transcript freshness, elapsed,
   hype level).
3. Call `decide(engineRef.current, signal)`.
4. If it returns a line: commit the new engine state, push the line into
   history, call `speakLine()`, and re-compute the visible `hypeScore`.
5. If it returns null: just re-compute `hypeScore`.

`hypeScore = paceKmh * 4 + movementIntensity * 30 + min(40, minutes * 8)`,
clamped to [0, 100]. Drives the HUD meter and the photo-finish export.

## 5. Post-hackathon upgrade paths

- Proxy the API key through a serverless function so the static bundle
  stops shipping the credential.
- Replace the template engine with a Convai-backed agent that keeps
  context across the full run and can react mid-sentence.
- MediaRecorder + Web Audio graph to export the session as a single MP3
  or MP4, so athletes can post the audio alongside their handheld video.
- Pace-band music bed: regenerate the music prompt every km with a
  different BPM / mood based on the athlete's current pace band.
