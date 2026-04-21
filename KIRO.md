# Built with Kiro

This is the required Kiro-usage write-up for the ElevenLabs × Kiro
hackathon submission. It answers the six prompts from the submission
form directly, references concrete artefacts in the repo, and is
honest about which parts of the work Kiro owned.

## Repository signals

- `.kiro/specs/stadium/{requirements,design,tasks}.md` — the complete
  spec for the shipped product, in Kiro's three-phase format, with
  24+ EARS requirements and their implementation status.
- `.kiro/specs/session-recap/{requirements,design,tasks}.md` — the
  **next** feature's spec, written first and waiting to be
  implemented. It's intentionally left unimplemented so the next Kiro
  session has a clean, load-bearing unit of work to drive.
- `.kiro/steering/{product,tech,structure}.md` — project-wide
  guardrails that any agent picking up the repo reads before touching
  code.
- `.kiro/hooks/{pre-commit-typecheck,requirement-trace-guard}.md` —
  agent-hook definitions that operate on the decision engine and the
  API proxy.
- `AGENTS.md` — the root-level briefing file any agent reads on first
  interaction; points at the steering docs and defines commit style.
- `// R3` style requirement traces in `src/lib/commentary.ts` and
  `src/lib/director.ts` — each trigger is annotated with the EARS id
  it implements, so requirements and code are linked both ways.

## 1. Vibe coding

> *How did you structure your conversations with Kiro to build your
> project? What was the most impressive code generation Kiro helped
> you with?*

The conversation pattern that held up best was **"one load-bearing
decision at a time"**: instead of describing the whole product, I
asked the agent to solve a single architectural problem, let it
commit the result, then moved on. Examples from the commit log:

- *"Design a pure `decide(state, signal)` function that emits the next
  broadcast line from a state machine. No React, no audio, no LLM —
  just the function."* — produced `src/lib/commentary.ts` in one pass,
  including 12 trigger types and a filler-rotation that weights
  dry / observational beats over shouty hype.
- *"Design a broadcast director that sits above the commentary engine,
  classifies the moment (pace surge, goal approach, final push, …),
  computes a 0-100 intensity score, and builds the LLM prompt. Keep
  it pure; the hook wires it."* — produced `src/lib/director.ts` with
  event + intensity + prompt builders separated cleanly.
- *"Turn `audio.play()` on a just-decoded data-URL into a non-blocking
  call. The current await never resolves and the whole warming phase
  hangs."* — one-line fix with a comment explaining the decode
  timing issue for the next reader.

The most useful *kind* of generation wasn't any single piece of code —
it was the **pairing of code with its own justification**. Every
non-trivial function Kiro wrote came back with a short comment
explaining the non-obvious trade-off it resolved (why `preservesPitch`
is true, why `AnimatePresence mode="wait"` was removed, why the
backdrop in `CountdownOverlay` persists). That compounds: the next
agent reading the file doesn't have to re-derive the reasoning.

## 2. Agent hooks

> *What specific workflows did you automate with Kiro hooks? How did
> these hooks improve your development process?*

Two hooks live in `.kiro/hooks/`:

### `pre-commit-typecheck.md` (trigger: on-save)

Runs `tsc -b --noEmit` against `src/` and `api/` on every save.
Reason: STADIUM is a real-time audio app with an HMR dev loop, and a
TypeScript error that reaches the running dev server corrupts the
broadcast state (half-instantiated refs, partially applied settings).
Catching the error at save-time instead of at next re-render kept the
feedback loop tight during the `useBroadcast` refactors.

### `requirement-trace-guard.md` (trigger: before-commit)

Parses `.kiro/specs/stadium/requirements.md` for EARS ids, then walks
`commentary.ts` / `director.ts` / `goal.ts` asserting every
requirement-implementing function carries a `// R{n}` trace comment.

This matters because **the spec is only load-bearing if the code
points back at it**. Without the hook, those traces decay. With it,
either the trace exists and matches or the commit fails — the
spec stays coupled to the implementation instead of drifting into
documentation.

## 3. Spec-driven development

> *How did you structure your spec for Kiro to implement? How did
> the spec-driven approach improve your development process? How did
> this compare to vibe coding?*

I used Kiro's three-document format for every meaningful feature:

- **`requirements.md`** — EARS-format acceptance criteria (`When X,
  the system shall Y`). No implementation hints; just behaviour the
  system must exhibit. See `.kiro/specs/stadium/requirements.md`
  for the shipped product's 18 requirements.
- **`design.md`** — architectural decisions with explicit trade-offs.
  Every non-obvious choice comes with a *Why* and a *Trade-off* line
  so a future reader can tell whether the constraint still holds.
- **`tasks.md`** — sequenced implementation plan with a status column
  that gets flipped in the same commit that completes the task, so
  the spec trail reads as *in progress* rather than as post-hoc
  documentation.

**How spec-driven compared to vibe-coding on this project:**

- Vibe-coding was fastest for *timing / feel / aesthetic* work — the
  cold-open choreography (welcome → 3-2-1 → horn), the intensity →
  playbackRate curve, the commentary tone. These aren't amenable to
  specs because the acceptance criterion is "does it sound good" and
  you need to iterate in-session to find it.
- Spec-driven was fastest for the *load-bearing logic* — the goal-
  progress math, the director's event classification, the serverless
  proxy contract. Those have concrete I/O. Writing the spec first
  meant the implementation pass was mechanical, and the specs then
  served as regression checklists for later refactors.

The clearest win was the **session-recap** feature in
`.kiro/specs/session-recap/`. It's spec'd-first and unimplemented —
deliberately — so the next Kiro session has a clean target: 15 tasks,
each scoped to a single requirement, each independently testable. The
spec itself includes a "How a Kiro session should approach this"
closing note so the agent doesn't have to reconstruct the sequencing
from scratch.

## 4. Steering docs

> *How did you leverage steering to improve Kiro's responses? Was
> there a particular strategy that made the biggest difference?*

Three steering files in `.kiro/steering/`:

- **`product.md`** — what STADIUM is, who it's for, tone and voice,
  what's explicitly out of scope. Prevented scope creep like "should
  we add social leaderboards" or "what about a calorie counter."
- **`tech.md`** — the vendor contract (TTS model, SFX endpoint, music
  endpoint), the conventions (pure logic modules over classes, refs
  over state inside tick loops), and explicit "what not to reach
  for" (no global state manager, no CSS-in-JS, no classes, no `any`).
- **`structure.md`** — the canonical file layout, naming conventions
  (`PascalCase.tsx` for components, `camelCase.ts` for modules), and
  commit style.

The **single biggest wedge** was `structure.md`'s "commit style"
section: *"One commit per logical chunk, imperative voice in the
subject, a body that explains **why** (not what — the diff already
shows that) and lists the user-visible change when relevant."*

That shaped the git log into something a judge can read as a
narrative of the build, not a list of "fix typo" / "more changes"
commits. The log itself became an artefact — anyone can run
`git log --oneline` and see the actual spec of how STADIUM evolved:

```
Cut mic / speech-recognition feature entirely — output audio is the product
Fix welcome/countdown overlap, feedback loop, robotic audio…
Move API keys server-side: /api/* proxy via Vercel serverless functions
Theatrical cold-open: welcome → 3-2-1 countdown → horn → session clock
Dynamic commentary: GPT-5.4-mini + broadcast director + goal system
…
```

The second biggest wedge was `tech.md`'s **"refs over state inside
the tick loop"** guidance. STADIUM's broadcast tick runs every 1.2
seconds and reads via `motionRef`, `transcriptRef`, `engineRef`,
`speakingRef`. Without that steering, the agent would have
happily closed over stale React state from the `useCallback` — a
bug that's invisible until a user plays their 20th session of the
day. The rule came up pre-emptively in every useBroadcast
modification.

## 5. MCP

> *How did extending Kiro's capabilities help you build your project?
> What sort of features or workflow improvements did MCP enable that
> otherwise would have been difficult or impossible?*

Two MCP integrations mattered meaningfully:

- **A browser-automation MCP server** (Claude-in-Chrome flavoured):
  gave the agent direct access to the running dev-server tab — it
  could tap GO, screenshot the live HUD, inspect `fetch()` calls
  against `/api/*`, verify network responses, and read console
  errors without leaving the IDE. This was how I diagnosed the
  mic-feedback bug (I had the agent tap GO + watch the network tab
  + read the Speech API events + correlate with the robotic-voice
  symptom — all without context-switching to a browser).
- **GitHub CLI via MCP**: `gh repo create`, `gh repo edit`, pull
  request / issue creation all happened inside the same conversation.
  For a hackathon ship-cycle that means the gap between "commit
  landed" and "pushed to the remote that the submission form will
  read" is zero.

The sharper observation from working this way: MCP flips the
agent's role from *"here's the code, go paste it into your terminal"*
to *"I just did the thing and here's what happened."* For iterations
like the API-proxy migration — where I needed to verify that
`/api/tts`, `/api/voices`, and `/api/llm` were all 200-OK end-to-end
after each change — that loop tightness was the difference between
confident progress and every step needing a manual sanity check.

## 6. Kiro powers

> *Which powers did you leverage for bundled best practices and
> expertise in Kiro? Did you use any third-party tooling or
> integrations you wouldn't have otherwise?*

- **Requirement-to-code traceability (via the requirement-trace-guard
  hook above).** The `// R3` comments in `lib/commentary.ts` /
  `director.ts` / `goal.ts` are the user-visible surface of this. The
  power itself is the discipline: you cannot merge a decision-engine
  change without pointing it at a requirement. I hadn't built this
  pattern into projects before; it's now the default for any future
  spec-driven project I take on.
- **The three-document spec shape** (requirements → design → tasks)
  was itself a "power" in the sense that Kiro knows to co-generate
  all three when you start a new feature. `.kiro/specs/session-recap/`
  shows the format in the wild: a spec written first, the tasks table
  structured so Kiro's agent can pick rows off the top one at a time.
- **Third-party tooling I wouldn't have reached for otherwise:**
  - `dotenv/config` auto-loading in the serverless functions —
    suggested by the agent when I hit `process.env.ELEVENLABS_API_KEY`
    being undefined in the Vite dev plugin. I'd have hand-rolled
    `fs.readFileSync(".env")` otherwise.
  - `framer-motion`'s `mode="popLayout"` for overlapping exit/enter
    on the countdown — proposed in-session when I described a
    "background flashes through between numbers" bug.
  - Web Audio synth for the countdown beeps + horn, instead of
    pre-recorded audio files. The agent preferred synthesis because
    it avoided a licensing question and produced the exact timing I
    needed. I'd have shipped mp3 assets otherwise.

---

## What Kiro did *not* do

For integrity: filming the hackathon demo video and posting to social
were handled outside the IDE. Everything in this repo — code, specs,
steering, hooks, traces, commit log — is the Kiro surface.

For the upcoming session-recap work (see
`.kiro/specs/session-recap/`): the spec and tasks are written; the
implementation is explicitly left for a live Kiro IDE session so the
spec-driven trail continues post-submission.
