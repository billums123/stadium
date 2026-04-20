# STADIUM — Tasks

Sequenced implementation plan that realises [`design.md`](./design.md).
Each task maps to one or more EARS requirements from
[`requirements.md`](./requirements.md). Status reflects current git state.

| # | Task | Requirements | Status |
|---|---|---|---|
| 1 | Scaffold Vite + React-TS, wire Tailwind v4, set mobile viewport + safe-area handling | — | ✅ |
| 2 | Broadcast theme tokens (blaze / volt / chalk / ink) + grain + scanline CSS | R7 | ✅ |
| 3 | `lib/elevenlabs.ts` — REST client for TTS, SFX, music, voices, key verification | R1–R5, R10 | ✅ |
| 4 | `lib/motion.ts` — GPS watch + DeviceMotion + `simulate()` for desktop | R2–R4, R7 | ✅ |
| 5 | `lib/speech.ts` — Web Speech API wrapper with auto-restart + graceful absence | R5, R14 | ✅ |
| 6 | `lib/commentary.ts` — pure `decide()` engine + line builders for every trigger | R2–R6 | ✅ |
| 7 | `lib/ambient.ts` — crowd bed (SFX when key available, pink noise otherwise) | R1, R10, R12 | ✅ |
| 8 | `lib/wakelock.ts` — screen wake lock wrapper, re-acquires on visibility change | R1 | ✅ |
| 9 | `hooks/useBroadcast.ts` — tick loop, speak queue, history, wake lock | R1, R2, R7, R11, R13 | ✅ |
| 10 | Components: Scoreboard, CaptionStream, SessionLog, HypeMeter, FlashOverlay, SettingsSheet, BroadcastButton, Ticker | R7–R9 | ✅ |
| 11 | Landing page (hero + ticker + pillars) and settings sheet (key verify) | R12, R17 | ✅ |
| 12 | Recursive mobile testing in Chrome at 430×900 viewport | R1, R7 | ✅ |
| 13 | Polish pass: hype meter, session log, flash overlay, `LINE HYPE` force button | R7–R9 | ✅ |
| 14 | Fix: broadcast start flow blocked on `audio.play()` decoding; swap `AnimatePresence mode="wait"` for a plain conditional | R1, R7 | ✅ |
| 15 | Production readiness: `VITE_ELEVENLABS_API_KEY` env var, turbo model default, wake lock, bad-key fallback | R1, R12, R13, R17 | ✅ |
| 16 | PWA manifest + apple-touch-icon | — | ✅ |
| 17 | Commentary pool expansion: 4–8 variants per builder + surroundings / ad-break / weather / finish-strong triggers | R2, R6 | ✅ |
| 18 | `lib/sharecard.ts` — 1080×1920 canvas render + Web Share / download fallback, wired into the scoreboard | R15, R16 | ✅ |
| 19 | Music API integration — background fetch, cross-fade in, fade out on stop | R10, R11 | ✅ |
| 20 | Public HTTPS deploy + real-device QA on iOS Safari and Android Chrome | all | ⏳ |
| 21 | Capture the viral clip | — | ⏳ |
| 22 | _(post-hackathon)_ Convai-backed commentary | R2, R5 | — |
| 23 | _(post-hackathon)_ MediaRecorder export of full session audio | — | — |
| 24 | _(post-hackathon)_ Proxy the API key through a serverless function | R17 | — |
