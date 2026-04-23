# STADIUM

**Every step, the main event.**

An AI sports broadcast for your walk, run, or bike ride. You move, a
pro-grade AI commentator goes feral. Crowd roars included. Set a
goal, hit GO, get a cold-open with a countdown and a starting horn,
then a two-voice broadcast narrates your pace, goal progress, and
milestones in real time.

Submitted for the **ElevenLabs × Kiro hackathon** (Hack #5).
`#ElevenHacks #CodeWithKiro`

---

## Built with Kiro

See [`KIRO.md`](./KIRO.md) for the full write-up — vibe coding, agent
hooks, spec-driven development, steering docs, MCP, and which Kiro
powers were used. Artifacts live in [`.kiro/`](./.kiro/):

```
.kiro/
├── specs/
│   ├── stadium/          ← the shipped product, fully spec'd
│   │   ├── requirements.md   (EARS-style, R1–R18)
│   │   ├── design.md         (architectural trade-offs)
│   │   └── tasks.md          (sequenced, with status column)
│   └── session-recap/    ← the NEXT feature, spec'd first, unimplemented
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md          (15 tasks ready for an agent session)
├── steering/
│   ├── product.md        (scope, tone, out-of-scope)
│   ├── tech.md           (stack, conventions, "what not to reach for")
│   └── structure.md      (naming, commit style, file layout)
└── hooks/
    ├── pre-commit-typecheck.md
    └── requirement-trace-guard.md
```

Requirement-to-code traceability is enforced by `// R3` style
comments in `src/lib/commentary.ts`, `src/lib/director.ts`, and
`src/lib/goal.ts` — every trigger points back at the EARS requirement
it implements.

---

## What it does

Put your phone in a pocket, tap **GO**, and:

1. The commentator delivers a welcome (time-of-day aware, references
   your name and career history).
2. A visual 3-2-1 countdown fires with beeps.
3. An air-horn sounds and the session clock starts.
4. As you move, the broadcast reacts live:
   - Pace surges trigger urgent "HE'S KICKING" lines
   - Kilometre milestones get their own beat
   - Goal progress ("behind by 14 m, 8 s left, required pace 16 km/h")
     drives the voice faster and more intense
5. When you hit the goal, confetti + an ecstatic closing.

The UI is a broadcast scoreboard designed to look expensive in a
vertical video clip.

## Stack

| Layer | Tech |
|---|---|
| Voice commentary | ElevenLabs TTS (`eleven_turbo_v2_5`), two voices alternating (play-by-play + color) |
| Stadium crowd bed | ElevenLabs Sound Generation — generated once, looped |
| Music bed | ElevenLabs Music (`/v1/music`) — cinematic anthem, cross-faded in |
| Dynamic commentary | OpenAI GPT-5.4-mini via same-origin `/api/llm` proxy, falls back to template engine on timeout |
| Live signals | `navigator.geolocation.watchPosition`, `DeviceMotionEvent`, `navigator.wakeLock` |
| Key safety | Serverless `/api/*` Vercel functions hold `ELEVENLABS_API_KEY` / `OPENAI_API_KEY` — browser never sees them |
| UI | React 19 · Vite · Tailwind CSS v4 · Framer Motion |

## Quickstart

```bash
cp .env.example .env
# set ELEVENLABS_API_KEY and OPENAI_API_KEY (server-side, no VITE_ prefix)
npm install
npm run dev
# open http://localhost:5173
```

The Vite dev server mounts the `/api/*` handlers locally via the
plugin in `vite.config.ts`, using the same code that runs on Vercel
in production.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md). One-line on Vercel:

```bash
vercel env add ELEVENLABS_API_KEY production
vercel env add OPENAI_API_KEY production
vercel deploy --prod
```

## Architecture

```
src/
  App.tsx                       top-level screen + bottom nav
  hooks/useBroadcast.ts         start/stop orchestration + tick loop

  lib/
    elevenlabs.ts               /api/* client (TTS + SFX + music + voices)
    llm.ts                      /api/llm client for GPT-5.4-mini
    motion.ts                   GPS + accelerometer + simulate()
    commentary.ts               pure template engine (decide fn)
    director.ts                 event classification + intensity + prompts
    goal.ts                     Goal + computeProgress() math
    ambient.ts                  crowd + music bed loaders
    sharecard.ts                1080×1920 canvas photo-finish
    soundfx.ts                  Web Audio beep + air-horn synthesis
    wakelock.ts                 screen wake-lock handle
    career.ts                   localStorage session persistence
    haptics.ts                  navigator.vibrate patterns
    permissions.ts              motion + geolocation primer
    timeOfDay.ts                morning / today / tonight helper
    tags.ts                     strip [audio-tag] delivery cues

  components/                   Scoreboard, CaptionStream, SessionLog,
                                HypeMeter, FlashOverlay, GoalPicker,
                                GoalHud, AthleteName, Confetti,
                                CountdownOverlay, PermissionPrimer,
                                SettingsSheet, BroadcastButton, Ticker

api/                            Vercel serverless functions
  tts.ts sfx.ts music.ts voices.ts llm.ts
  _shared.ts                    body parser + env helpers
```

The decision engine (`lib/commentary.ts` + `lib/director.ts`) is
**pure** — `decide(state, signal, lastLine)` takes an engine state
plus a snapshot of motion + goal progress + career stats + session
time, and returns `null` or `{ line, next }`. That makes the whole
broadcast deterministic, testable, and trivially swappable to a
Convai-backed generator later.

## Dev-only demo controls

Hidden in production. Available when running `npm run dev`:

- **SIM · RUN PACE** – fakes an 11 km/h jog so pace-surge and km
  milestones fire while you sit at your laptop
- **SIM · WALK** – drops simulated pace so the "concerning dip" line
  can fire
- **CUE · LINE** – force-fires an immediate commentary line for
  on-demand testing

Production UI stays hands-free — tap GO, the app drives itself.

## Viral playbook

1. Phone in a chest strap or pocket.
2. **Earbuds in** if possible — gives the cleanest camera-captured
   commentary and avoids the phone speaker's echo cancellation.
3. Film yourself from a second phone or a friend.
4. Tap **GO** and start moving.
5. The dash-to-finish and victory horn punctuate the last ~5% — plan
   your sprint so the camera catches it.
6. Tap **◉ SHARE** during the session for a photo-finish PNG.
7. Post with `#ElevenHacks #CodeWithKiro`, tag `@kirodotdev` and
   `@elevenlabsio`.

## License

MIT — see [`LICENSE`](./LICENSE).
