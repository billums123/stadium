# STADIUM

**Every step, the main event.**

An AI sports broadcast for your run, walk, or bike ride. You move, an ElevenLabs commentator goes feral. Crowd roars included.

Built for **ElevenLabs × Kiro Hackathon #4** (`#ElevenHacks` · `#CodeWithKiro`).

![Stadium HUD](./.github/screenshot.png)

## The pitch

Put headphones in, put your phone in a chest strap or pocket, tap **GO**, and start moving. STADIUM reads your GPS pace, your accelerometer, and anything you shout into your mic, and produces live play-by-play — the bit where the TV announcer says *"HE'S KICKING! Where is this coming from?! The legs are gone and yet — they keep going!"* — over a loopable crowd-roar bed generated from ElevenLabs Sound Effects.

The UI is designed to look good on a phone held out at arm's length while you are literally running down the street filming it. This is the viral video.

## What it uses

| Layer | Tech |
|---|---|
| Voice commentary | ElevenLabs TTS (`eleven_multilingual_v2`) with configurable voice + hype-driven style |
| Stadium crowd bed | ElevenLabs Sound Generation (`/v1/sound-generation`) — generated once, looped |
| Live signals | `navigator.geolocation.watchPosition`, `DeviceMotionEvent`, Web Speech API |
| State machine | Template-driven commentary engine with pace-change, milestone, and user-quote triggers |
| UI | React 19 · Vite · Tailwind CSS v4 · Framer Motion |

No API key? The app still runs in **demo voice mode** using the browser's built-in `speechSynthesis`, so everything is testable without a paid plan.

## Quickstart

```bash
npm install
npm run dev
# open http://localhost:5173 on your phone
```

Open **Settings** and paste an ElevenLabs API key (it stays in `localStorage`, never leaves the browser). Pick a voice, set your athlete name, crank the hype level, hit **GO**.

## Demo controls (useful indoors)

- **SIM · RUN PACE** – fakes an 11 km/h jog so the pace-surge and kilometre milestones fire even while you sit still
- **LINE HYPE** – force-triggers an immediate commentary line for on-demand video cuts
- **SIM · WALK** – drops the simulated pace back down so you can test the "concerning dip" crash line

## Architecture

```
src/
  App.tsx                       top-level screen + bottom nav
  hooks/useBroadcast.ts         start/stop orchestration; tick loop
  lib/
    elevenlabs.ts               REST client (TTS + SFX + voices)
    motion.ts                   GPS + accelerometer + simulate()
    speech.ts                   Web Speech API wrapper
    commentary.ts               pure trigger engine → Line
    ambient.ts                  crowd bed loader (SFX or pink noise)
    store.ts                    localStorage-backed settings hook
  components/                   Scoreboard, CaptionStream, SessionLog,
                                HypeMeter, FlashOverlay, SettingsSheet,
                                BroadcastButton, Ticker
```

The commentary engine (`lib/commentary.ts`) is intentionally **pure** — `decide(state, signal)` takes the current engine state plus a snapshot of motion + speech + session time, and returns either `null` (stay quiet) or `{ line, nextState }`. That makes the whole broadcast deterministic enough to test, and makes future LLM-driven variants a drop-in swap.

## Spec-driven development

This project was built from the spec in [`SPEC.md`](./SPEC.md), following Kiro's requirements → design → tasks flow. See that file for the original EARS-style acceptance criteria and the task breakdown.

## Viral playbook

1. Put the phone in a chest strap.
2. Earbuds in, mic open.
3. Film yourself from a second phone or a friend.
4. Tap **GO** and start running.
5. Shout something absurd into your collar mic every ~30 seconds. The broadcast will quote you.
6. Hit **LINE HYPE** right as you cross a landmark.
7. Post it with `#ElevenHacks` · `#CodeWithKiro`. Tag `@elevenlabsio` and `@kirodotdev`.
