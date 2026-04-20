# Tech steering

## Stack

- **Build:** Vite 8 + React 19 + TypeScript. Static SPA, no backend.
- **Styling:** Tailwind CSS v4 via the `@tailwindcss/vite` plugin. Design
  tokens (`--color-blaze`, `--color-volt`, `--color-chalk`, `--color-ink`)
  live in `@layer theme` inside `src/index.css` and are used directly
  as `bg-[var(--color-blaze)]` etc. in class names.
- **Motion / animation:** Framer Motion.
- **Audio:** plain `HTMLAudioElement` instances. No Web Audio graph
  unless / until we export recorded sessions (§5 in the spec).

## Vendor contract

- **TTS:** `POST /v1/text-to-speech/{voice_id}`, model
  `eleven_turbo_v2_5` by default (lower TTFB keeps commentary feeling
  live). Fall back to `speechSynthesis` on auth failure.
- **SFX:** `POST /v1/sound-generation` for the 12 s crowd bed, cached
  per-session.
- **Music:** `POST /v1/music` for an optional 30 s cinematic bed,
  background-loaded so it never blocks the broadcast from going live.
- **Key storage:** `VITE_ELEVENLABS_API_KEY` env var (bundled) or
  `localStorage` (user-supplied in Settings). User-supplied wins.

## Conventions

- **Pure logic modules over classes.** The commentary engine is a pure
  function; motion / speech / wake lock modules each export a small
  factory returning a start/stop handle. No class-based state.
- **Refs over state** for values that are read inside interval
  callbacks (`motionRef`, `transcriptRef`, `engineRef`, `speakingRef`),
  so the tick loop never closes over a stale React value.
- **Permissions requested lazily**, inside the button handler that
  needs them. Never at module load.
- **No hooks inside loops or conditions.** Standard React rules.
- **Error handling at the boundary.** A failure inside `speakLine`
  catches, surfaces a banner via `error`, and falls back to
  `speechSynthesis` so the session stays alive.

## What not to reach for

- A global state manager. The app has three ephemeral state shapes
  (`BroadcastStatus`, `Settings`, transient UI toggles); they don't
  need Redux / Zustand.
- CSS-in-JS. Tailwind's utility-first + CSS variables cover it.
- Class components.
- `any`. Prefer `unknown` + narrow, or inline `as` with a comment.
