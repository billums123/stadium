# Structure steering

## File layout

```
src/
  App.tsx                 — top-level layout + screen routing
  main.tsx                — React root
  index.css               — design tokens + keyframes

  hooks/
    useBroadcast.ts       — session orchestration hook

  lib/
    elevenlabs.ts         — REST client (TTS, SFX, music, voices)
    motion.ts             — GPS + accel + simulate()
    speech.ts             — Web Speech API wrapper
    commentary.ts         — pure decide() + builders
    ambient.ts            — crowd + music bed loaders
    sharecard.ts          — canvas photo-finish export
    wakelock.ts           — screen wake lock handle
    store.ts              — useSettings() hook

  components/             — one file per visual component, PascalCase

public/
  favicon.svg
  icon.svg                — 512 square used by the PWA manifest
  manifest.webmanifest

.kiro/                    — spec-driven workflow artifacts
  specs/stadium/{requirements,design,tasks}.md
  steering/{product,tech,structure}.md

SPEC.md                   — human-readable single-page spec (mirror of
                            .kiro/specs/stadium/* for non-Kiro readers)
README.md                 — how to run / deploy / film the viral clip
.env.example              — VITE_ELEVENLABS_API_KEY placeholder
```

## Naming conventions

- **Components:** `PascalCase.tsx`, one default/named export per file,
  co-located with no sibling test file for now.
- **Modules:** `camelCase.ts`; exported factories use verb-first
  (`createMotionTracker`, `startSpeechListener`, `acquireWakeLock`).
- **Types:** `PascalCase` interface / type aliases next to the module
  that owns them; shared types live with the hook that composes them.
- **CSS:** no CSS files beyond `index.css`. Use Tailwind classes or
  inline `style` for one-off canvas-driven UIs.

## Commit style

One commit per logical chunk, imperative voice in the subject line, a
body that explains **why** (not what — the diff already shows that) and
lists the user-visible change when relevant. See existing `git log
--oneline` for the cadence.

When a task in `tasks.md` completes, flip its status column in the same
commit that finishes the work, so the spec trail stays current without
a dedicated bookkeeping pass.
