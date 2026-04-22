/**
 * Commentary engine. Watches motion + speech signals and produces broadcast lines.
 *
 * Two voices share the mic: the play-by-play commentator drives the urgent
 * beats (openings, pace surges, milestones, quotes), and a color commentator
 * adds a drier one-liner between plays. Both are pure template builders —
 * easy to swap to Convai later, easy to test now.
 *
 * Requirement traces use the `// R{n}` convention from
 * .kiro/specs/stadium/requirements.md.
 */

import type { MotionState } from "./motion";
import type { Career } from "./career";
import type { UnitSystem } from "./units";
import { distanceUnitSpoken, paceIn, paceUnitSpoken } from "./units";

export type Signal = {
  athleteName: string;
  motion: MotionState;
  lastTranscript: string | null;
  lastTranscriptAgeMs: number;
  elapsedInSessionMs: number;
  hypeLevel: number; // 1-5
  career: Career;
  units: UnitSystem;
};

/**
 * Convert the internal km/h pace to the athlete's preferred unit and
 * produce the phrase the commentator says — used by every template
 * that references pace aloud.
 */
function spokenPace(kmh: number, units: UnitSystem): string {
  return `${paceIn(kmh, units).toFixed(1)} ${paceUnitSpoken(units)}`;
}

/** Same for distance ("3.2 miles" or "5 kilometres") in the athlete's units. */
function spokenDistance(meters: number, units: UnitSystem): string {
  if (units === "imperial") {
    const mi = meters / 1609.34;
    const w = mi === 1 ? "mile" : "miles";
    return `${trimZero(mi)} ${w}`;
  }
  const km = meters / 1000;
  const w = km === 1 ? "kilometre" : "kilometres";
  return `${trimZero(km)} ${w}`;
}

function trimZero(n: number) {
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export type Voice = "play" | "color";

export type Trigger =
  | "cold-open"
  | "opening"
  | "quote"
  | "pace-surge"
  | "pace-crash"
  | "steady"
  | "milestone-km"
  | "check-in"
  | "surroundings"
  | "weather"
  | "finish-strong"
  | "color-aside"
  | "signoff";

export type Line = {
  trigger: Trigger;
  voice: Voice;
  text: string;
  urgency: 1 | 2 | 3; // 1 low, 3 dramatic
};

const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function pace(kmh: number) {
  if (kmh < 2.5) return "cooldown";
  if (kmh < 6) return "walk";
  if (kmh < 10) return "jog";
  if (kmh < 16) return "run";
  return "bike";
}

function paceWord(kmh: number) {
  return {
    cooldown: "a hero's stroll",
    walk: "a power walk",
    jog: "a respectable jog",
    run: "a serious pace",
    bike: "ridiculous speed",
  }[pace(kmh)];
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Prefixes live in a small pool, used sparingly — overuse turns the
// commentator into a shouty GIF. See anti-cheese notes in design.md.
const PLAY_PREFIXES = [
  "Folks,",
  "Oh my word —",
  "Coming to you LIVE,",
  "This just in —",
  "On the broadcast,",
];

function maybePrefix(prob = 0.35): string {
  return Math.random() < prob ? rand(PLAY_PREFIXES) + " " : "";
}

// ─── R1: Cold-open (pre-game show) ─────────────────────────────────────
export function coldOpenScript(s: Signal): Line[] {
  const name = s.athleteName;
  const lifetimeDistance =
    s.units === "imperial"
      ? `${Math.round(s.career.totalKm * 0.621371)} lifetime miles`
      : `${Math.round(s.career.totalKm)} lifetime kilometres`;
  const careerTag =
    s.career.sessions === 0
      ? `a debut — no prior broadcasts on record`
      : s.career.sessions === 1
      ? `their second broadcast — the follow-up album`
      : `broadcast number ${s.career.sessions + 1}, ${lifetimeDistance} on the board`;

  const hour = new Date().getHours();
  const slot =
    hour < 6 ? "the pre-dawn slot" :
    hour < 11 ? "the morning show" :
    hour < 14 ? "the midday broadcast" :
    hour < 18 ? "the afternoon card" :
    hour < 22 ? "primetime" :
    "the late-night edition";

  return [
    {
      trigger: "cold-open",
      voice: "play",
      urgency: 3,
      text: `Good evening, good morning, or good afternoon — welcome to STADIUM. You are tuned in to ${slot}. Tonight's main event: ${name}.`,
    },
    {
      trigger: "cold-open",
      voice: "color",
      urgency: 2,
      text: `That's ${careerTag}. Conditions on the ground: looking frankly ideal.`,
    },
    {
      trigger: "cold-open",
      voice: "play",
      urgency: 3,
      text: `We are live in three. Two. One. And we are underway.`,
    },
  ];
}

// ─── R2: Opening (after cold open if present, otherwise first line) ────
export function buildOpening(s: Signal): Line {
  const name = s.athleteName;
  const opts = [
    `And we're back. ${name}, out of the tunnel, onto the pavement. Let's call it.`,
    `${name} — in position. Everything is exactly as it should be. Almost suspiciously so.`,
    `Right. ${name} is moving. The clock is running. The broadcast is ours.`,
    `The stage is set. ${name} has arrived. The competition — honestly, unclear. But ${name} has arrived.`,
  ];
  return { trigger: "opening", voice: "play", urgency: 3, text: rand(opts) };
}

// ─── R5: Quote ─────────────────────────────────────────────────────────
export function buildQuote(s: Signal): Line {
  const q = (s.lastTranscript || "").slice(0, 140);
  const name = s.athleteName;
  const opts = [
    `${name} on the mic: "${q}".`,
    `Statement from the competitor: "${q}". Put it on the wall.`,
    `${name} goes on record: "${q}". The press box is silent.`,
    `A line from ${name} — "${q}". We'll be quoting that one for weeks.`,
    `Mid-stride, ${name} lands it: "${q}". Beautiful.`,
  ];
  return { trigger: "quote", voice: "play", urgency: 2, text: rand(opts) };
}

// ─── R3: Pace surge ────────────────────────────────────────────────────
export function buildPaceSurge(s: Signal): Line {
  const p = spokenPace(s.motion.paceKmh, s.units);
  const name = s.athleteName;
  const opts = [
    `Another gear. ${name} at ${p}.`,
    `A shift. ${p}. Somebody decided today.`,
    `${name}, ${p}. Scouts just leaned forward.`,
    `Surge. ${p}. Not scheduled. Welcome.`,
    `Second gear. ${p}. Here we go.`,
  ];
  return { trigger: "pace-surge", voice: "play", urgency: 3, text: rand(opts) };
}

// ─── R3: Pace crash (measured, not panicked) ──────────────────────────
export function buildPaceCrash(s: Signal): Line {
  const p = spokenPace(s.motion.paceKmh, s.units);
  const name = s.athleteName;
  const opts = [
    `Slight dip. ${p}. Strategic, presumably.`,
    `${p}. A breather. Saving the stretch.`,
    `${name} eases to ${p}. Reading the room.`,
    `${p}. The kind champions take.`,
  ];
  return { trigger: "pace-crash", voice: "play", urgency: 2, text: rand(opts) };
}

// ─── R2: Steady state ──────────────────────────────────────────────────
export function buildSteady(s: Signal): Line {
  const p = spokenPace(s.motion.paceKmh, s.units);
  const name = s.athleteName;
  const opts = [
    `${name} settles into ${paceWord(s.motion.paceKmh)} — ${p}.`,
    `Holding ${p}. Metronomic.`,
    `Steady ${p}. Form intact.`,
    `${p}. ${name} doing ${name} things.`,
  ];
  return { trigger: "steady", voice: "play", urgency: 1, text: rand(opts) };
}

// ─── R4: Distance milestone (whole kilometres in metric, miles in imperial) ──
export function buildMilestoneKm(s: Signal, n: number): Line {
  const name = s.athleteName;
  const unit = distanceUnitSpoken(s.units, n !== 1);
  const unitSingular = distanceUnitSpoken(s.units, false);
  const opts = [
    `${ordinal(n)} ${unitSingular} — banked. ${name} ticks it off.`,
    `That's ${n} ${unit} in the book. ${name} does not look up. ${name} is locked in.`,
    `${maybePrefix()}${n} ${unit}. A round number in a round world.`,
    `Mark it: ${unitSingular} ${n}. Put it in the ledger.`,
    `${n} down. ${name} crosses the invisible line, the universe nods.`,
  ];
  return { trigger: "milestone-km", voice: "play", urgency: 3, text: rand(opts) };
}

// ─── R2: Check-in ──────────────────────────────────────────────────────
export function buildCheckIn(s: Signal): Line {
  const mins = Math.floor(s.motion.elapsedMs / 60000);
  const name = s.athleteName;
  const opts = [
    `${mins} minutes in. ${name} has the look.`,
    `Clock reads ${mins}. Nobody has said anything stupid yet. Promising.`,
    `We are ${mins} minutes into whatever this is. ${name} is, so far, winning it.`,
    `${mins} on the clock. The documentary crew would be getting excited right about now.`,
  ];
  return { trigger: "check-in", voice: "play", urgency: 1, text: rand(opts) };
}

// ─── R6: Surroundings (dry flavour, strongest voice in the pool) ───────
export function buildSurroundings(_s: Signal): Line {
  const opts = [
    `A dog three houses back has taken notice. Absolute respect from the canine community.`,
    `A pedestrian has paused. They did not know today was going to go this way.`,
    `A traffic light has turned green at exactly the right moment. The universe is collaborating.`,
    `A squirrel just witnessed pace. It will tell its friends. Its friends will not believe it.`,
    `A cyclist has just been passed in spirit, if not in distance. They are reflecting.`,
    `A parent with a pram has nodded. A high honour in this neighbourhood.`,
    `Somebody opened a window. A small ovation.`,
    `A cat on a stoop, indifferent. A small defeat, fairly handled.`,
    `Two joggers coming the other way. Acknowledgement, mutual. Respect, assumed.`,
  ];
  return { trigger: "surroundings", voice: "color", urgency: 2, text: rand(opts) };
}

// ─── R6: Weather beat ─────────────────────────────────────────────────
export function buildWeather(_s: Signal): Line {
  const opts = [
    `Conditions: the sky is doing the sky thing. No complaints from the competitor.`,
    `Weather report: breezy, with a chance of personal record.`,
    `Meteorological note: currently, it is outside.`,
    `The forecast held. That's one box ticked.`,
  ];
  return { trigger: "weather", voice: "color", urgency: 1, text: rand(opts) };
}

// ─── R6: Finish-strong (past 20 min mark) ─────────────────────────────
export function buildFinishStrong(s: Signal): Line {
  const name = s.athleteName;
  const opts = [
    `Home stretch. ${name}, one more push.`,
    `Closing minutes. The shower is earning itself.`,
    `Final section. All of this was for this.`,
    `Crowd stands. ${name} keeps moving.`,
  ];
  return { trigger: "finish-strong", voice: "play", urgency: 3, text: rand(opts) };
}

// ─── Color commentator's dry asides ────────────────────────────────────
// Fire after a play-by-play line to add a second-voice beat.
export function buildColorAside(_s: Signal, last: Line | null): Line {
  const opts: string[] = [];

  if (last?.trigger === "pace-surge") {
    opts.push(
      `Worth noting — that effort will be paid for later. But tonight, we celebrate.`,
      `Statistically, nobody asked for that. But here we are.`,
      `A risky play. Aesthetic merit: high.`
    );
  } else if (last?.trigger === "pace-crash") {
    opts.push(
      `In the booth we call this "the middle". It is a valid place to be.`,
      `The body is asking a question. The body does not always love the answer.`,
      `Pace fluctuates, as does the human spirit.`
    );
  } else if (last?.trigger === "milestone-km") {
    opts.push(
      `One more for the ledger. The ledger is growing.`,
      `A kilometre is a kilometre, and we should not be glib about that.`,
      `Quietly: that's a real achievement, and nobody here is being sarcastic.`
    );
  } else if (last?.trigger === "quote") {
    opts.push(
      `Big words, delivered under cardiovascular duress. That's commitment.`,
      `You heard it live. We can't unhear it.`,
      `The quote stands. The context — evolving.`
    );
  } else if (last?.trigger === "opening" || last?.trigger === "cold-open") {
    opts.push(
      `I'll say this: the energy coming into the studio today is extraordinary.`,
      `Low-key, I think this one's going to hit differently.`,
      `Conditions look favourable. The vibe is tentatively pro-athlete.`
    );
  } else {
    opts.push(
      `For context, I haven't had coffee yet. Neither has the athlete.`,
      `The commentary remains guardedly optimistic.`,
      `Nothing to add from my desk, which — if I'm honest — is rare.`,
      `I've been doing this a long time. This is a version of it.`
    );
  }

  return { trigger: "color-aside", voice: "color", urgency: 1, text: rand(opts) };
}

// ─── Signoff (R2) ──────────────────────────────────────────────────────
export function buildSignoff(s: Signal): Line {
  const name = s.athleteName;
  const opts = [
    `That's the whistle. ${name}, excellent work. We'll see you next time.`,
    `Broadcast closes. ${name} wrote a sentence out there, and the crowd will read it forever. Goodnight.`,
    `Sign-off from STADIUM. ${name} has earned the shower.`,
  ];
  return { trigger: "signoff", voice: "play", urgency: 3, text: rand(opts) };
}

// ─── Session recap closing lines (session-recap spec R9) ───────────────
// Template fallback when the LLM call for the closing beat fails.
// Three kinds so the outcome-specific tone always lands even offline.

export function buildRecapLine(
  kind: "complete" | "failed" | "free-run",
  s: Signal
): Line {
  const name = s.athleteName;
  const dist = spokenDistance(s.motion.distanceMeters, s.units);
  const mins = Math.max(1, Math.round(s.motion.elapsedMs / 60000));

  const complete = [
    `That's the whistle — ${name} hits the target. ${dist} in ${mins} on the clock. That's what they pay the scouts for.`,
    `Goal delivered. ${name} puts ${dist} in the book. The scoreboard respects it. The crowd respects it. We respect it.`,
    `Paid in full. ${name} lands the goal clean. A performance that will age well.`,
  ];
  const failed = [
    `The clock wins this round. ${name} came up short — ${dist}, ${mins} minutes, no shame. The scouts are already whispering about the rematch.`,
    `Not today — but honestly, every professional has this kind of session and lies about it later. ${name}, take the data, reload, come back.`,
    `Final whistle without the goal. ${dist} banked all the same. This one goes in the "character building" folder.`,
  ];
  const freeRun = [
    `And we're off the air. ${name} with ${dist} in ${mins} minutes — no target, just vibes, and the vibes held.`,
    `Broadcast closes. ${name} earned ${dist} of footage for their trouble. The crowd is standing. Quietly, but standing.`,
    `That's the sign-off. ${dist} on the book for ${name}. ${mins} minutes the commentator will remember forever.`,
  ];

  const pool = kind === "complete" ? complete : kind === "failed" ? failed : freeRun;
  return { trigger: "signoff", voice: "play", urgency: 3, text: rand(pool) };
}

export type EngineState = {
  coldOpenIndex: number;        // -1 done; else index into the cold-open script
  hasOpened: boolean;
  lastTriggerAt: number;        // ms in session
  lastPace: number;
  lastKmAnnounced: number;
  cooldownMs: number;
  interludeCount: number;
  lastVoice: Voice | null;      // to alternate voices
};

export const INITIAL_ENGINE: EngineState = {
  coldOpenIndex: 0,
  hasOpened: false,
  lastTriggerAt: -999999,
  lastPace: 0,
  lastKmAnnounced: 0,
  cooldownMs: 14000, // min gap between lines, tighter since color asides are shorter
  interludeCount: 0,
  lastVoice: null,
};

/**
 * Decide whether to emit a line this tick.
 *
 * Order of precedence: cold-open script → athlete quote → color aside
 * chasing the last play-by-play → milestone → pace surge/crash → filler.
 */
export function decide(
  state: EngineState,
  signal: Signal,
  lastLine: Line | null
): { line: Line; next: EngineState } | null {
  const now = signal.elapsedInSessionMs;
  const sinceLast = now - state.lastTriggerAt;

  // R1 — cold-open plays through before the engine takes over.
  if (state.coldOpenIndex >= 0) {
    const script = coldOpenScript(signal);
    const line = script[state.coldOpenIndex];
    const next: EngineState = {
      ...state,
      coldOpenIndex:
        state.coldOpenIndex + 1 >= script.length ? -1 : state.coldOpenIndex + 1,
      hasOpened: state.coldOpenIndex + 1 >= script.length ? true : state.hasOpened,
      lastTriggerAt: now,
      lastVoice: line.voice,
    };
    return { line, next };
  }

  if (!state.hasOpened) {
    const line = buildOpening(signal);
    return {
      line,
      next: {
        ...state,
        hasOpened: true,
        lastTriggerAt: now,
        lastPace: signal.motion.paceKmh,
        lastVoice: line.voice,
      },
    };
  }

  // R5 — quote takes priority when a fresh transcript arrives.
  if (signal.lastTranscript && signal.lastTranscriptAgeMs < 2500 && sinceLast > 6000) {
    const line = buildQuote(signal);
    return { line, next: bump(state, now, signal.motion.paceKmh, line.voice) };
  }

  // Two-voice dialog: after a substantial play-by-play line, give the color
  // voice a short turn before the next full cooldown. One in three beats.
  if (
    lastLine &&
    lastLine.voice === "play" &&
    state.lastVoice === "play" &&
    sinceLast > 4500 &&
    sinceLast < state.cooldownMs &&
    Math.random() < 0.55
  ) {
    const line = buildColorAside(signal, lastLine);
    return {
      line,
      next: { ...state, lastTriggerAt: now, lastVoice: line.voice },
    };
  }

  if (sinceLast < state.cooldownMs) return null;

  // R4 — kilometre milestone.
  const km = Math.floor(signal.motion.distanceMeters / 1000);
  if (km > state.lastKmAnnounced && km >= 1) {
    const line = buildMilestoneKm(signal, km);
    return {
      line,
      next: {
        ...bump(state, now, signal.motion.paceKmh, line.voice),
        lastKmAnnounced: km,
      },
    };
  }

  // R3 — pace dynamics.
  const dPace = signal.motion.paceKmh - state.lastPace;
  if (dPace > 2.5 && signal.motion.paceKmh > 8) {
    const line = buildPaceSurge(signal);
    return { line, next: bump(state, now, signal.motion.paceKmh, line.voice) };
  }
  if (dPace < -2.5 && state.lastPace > 5) {
    const line = buildPaceCrash(signal);
    return { line, next: bump(state, now, signal.motion.paceKmh, line.voice) };
  }

  // R2 — steady cadence with flavour rotation.
  const cadence = Math.max(14000, 48000 - signal.hypeLevel * 6500);
  if (sinceLast > cadence) {
    const line = pickFiller(state, signal);
    return {
      line,
      next: {
        ...bump(state, now, signal.motion.paceKmh, line.voice),
        interludeCount: state.interludeCount + 1,
      },
    };
  }

  return null;
}

function bump(state: EngineState, now: number, pace: number, voice: Voice): EngineState {
  return { ...state, lastTriggerAt: now, lastPace: pace, lastVoice: voice };
}

/**
 * R6 — flavour rotation. Weighted toward the color voice's dry beats so the
 * broadcast doesn't mono-tone into pace comments.
 */
function pickFiller(state: EngineState, signal: Signal): Line {
  const idx = state.interludeCount;

  if (idx > 0 && idx % 3 === 0) return buildSurroundings(signal);
  if (idx > 0 && idx % 5 === 0) return buildWeather(signal);

  if (signal.motion.elapsedMs > 20 * 60 * 1000 && Math.random() < 0.3) {
    return buildFinishStrong(signal);
  }

  return Math.random() < 0.45 ? buildSteady(signal) : buildCheckIn(signal);
}
