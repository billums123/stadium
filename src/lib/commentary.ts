/**
 * Commentary engine. Watches motion + speech signals and produces broadcast lines.
 * Entirely template-driven so the app works without an LLM — pure ElevenLabs demo.
 */

import type { MotionState } from "./motion";

export type Signal = {
  athleteName: string;
  motion: MotionState;
  lastTranscript: string | null;
  lastTranscriptAgeMs: number;
  elapsedInSessionMs: number;
  hypeLevel: number; // 1-5
};

export type Trigger =
  | "opening"
  | "quote"
  | "pace-surge"
  | "pace-crash"
  | "steady"
  | "milestone-km"
  | "milestone-half"
  | "check-in"
  | "signoff";

export type Line = {
  trigger: Trigger;
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
  return { cooldown: "a hero's stroll", walk: "a power walk", jog: "a respectable jog", run: "a serious pace", bike: "ridiculous speed" }[pace(kmh)];
}

const HYPE_PREFIXES = [
  "Ladies and gentlemen,",
  "Folks,",
  "Oh my word —",
  "Can you believe this?",
  "Coming to you LIVE,",
  "Unbelievable scenes —",
  "The crowd is on its feet —",
];

export function buildOpening(s: Signal): Line {
  const name = s.athleteName;
  return {
    trigger: "opening",
    urgency: 3,
    text: `${rand(HYPE_PREFIXES)} welcome to STADIUM. Today's main event — ${name}. Weather: irrelevant. Stakes: everything. Broadcast is LIVE.`,
  };
}

export function buildQuote(s: Signal): Line {
  const q = (s.lastTranscript || "").slice(0, 140);
  const name = s.athleteName;
  const reactions = [
    `${name} speaks: "${q}" — the stadium falls silent.`,
    `Into the mic now — ${name}: "${q}". Will history remember this line? Almost certainly yes.`,
    `"${q}" — you heard it here first. Poetry in motion.`,
    `${name} with a direct quote for the record: "${q}". The commentators look at each other, speechless.`,
  ];
  return { trigger: "quote", urgency: 2, text: rand(reactions) };
}

export function buildPaceSurge(s: Signal): Line {
  const kmh = s.motion.paceKmh.toFixed(1);
  return {
    trigger: "pace-surge",
    urgency: 3,
    text: `${rand(HYPE_PREFIXES)} ${s.athleteName} is KICKING! Up to ${kmh} kilometres per hour — where is this coming from?! The legs are GONE and yet — they keep going!`,
  };
}

export function buildPaceCrash(s: Signal): Line {
  const kmh = s.motion.paceKmh.toFixed(1);
  return {
    trigger: "pace-crash",
    urgency: 2,
    text: `A concerning dip. ${s.athleteName} has slowed to ${kmh} kilometres per hour. The bench is worried. The dog is worried. We are all worried.`,
  };
}

export function buildSteady(s: Signal): Line {
  const kmh = s.motion.paceKmh.toFixed(1);
  return {
    trigger: "steady",
    urgency: 1,
    text: `${s.athleteName} settling into ${paceWord(s.motion.paceKmh)} — ${kmh} kilometres per hour. Textbook form. The scouts are watching.`,
  };
}

export function buildMilestoneKm(s: Signal, km: number): Line {
  return {
    trigger: "milestone-km",
    urgency: 3,
    text: `KILOMETRE ${km} — in the books. ${s.athleteName} crosses the line, the crowd ERUPTS — they came here to see something special, and they are getting it.`,
  };
}

export function buildCheckIn(s: Signal): Line {
  const mins = Math.floor(s.motion.elapsedMs / 60000);
  const opts = [
    `${mins} minutes in. ${s.athleteName} looks focused. Locked in. The commentators exchange a nod.`,
    `The clock reads ${mins} minutes. The lungs are working. The playlist is peaking. We are in the thick of it.`,
    `We are ${mins} minutes into the performance of ${s.athleteName}'s career — and this broadcast stands behind every step.`,
  ];
  return { trigger: "check-in", urgency: 1, text: rand(opts) };
}

export function buildSignoff(s: Signal): Line {
  return {
    trigger: "signoff",
    urgency: 3,
    text: `And that is the final whistle. ${s.athleteName} — what a performance. The scoreboard will never forget. This has been STADIUM. Goodnight, and keep moving.`,
  };
}

export type EngineState = {
  hasOpened: boolean;
  lastTriggerAt: number; // in session ms
  lastPace: number;
  lastKmAnnounced: number;
  cooldownMs: number;
};

export const INITIAL_ENGINE: EngineState = {
  hasOpened: false,
  lastTriggerAt: -999999,
  lastPace: 0,
  lastKmAnnounced: 0,
  cooldownMs: 18000, // min gap between lines
};

/**
 * Decide whether to emit a line this tick, and which one.
 * Returns null when the engine should stay quiet.
 */
export function decide(state: EngineState, signal: Signal): { line: Line; next: EngineState } | null {
  const now = signal.elapsedInSessionMs;
  const sinceLast = now - state.lastTriggerAt;

  if (!state.hasOpened) {
    const line = buildOpening(signal);
    return {
      line,
      next: { ...state, hasOpened: true, lastTriggerAt: now, lastPace: signal.motion.paceKmh, lastKmAnnounced: 0 },
    };
  }

  // Quote takes priority when fresh transcript arrives.
  if (signal.lastTranscript && signal.lastTranscriptAgeMs < 2500 && sinceLast > 6000) {
    const line = buildQuote(signal);
    return {
      line,
      next: { ...state, lastTriggerAt: now, lastPace: signal.motion.paceKmh },
    };
  }

  if (sinceLast < state.cooldownMs) return null;

  const km = Math.floor(signal.motion.distanceMeters / 1000);
  if (km > state.lastKmAnnounced && km >= 1) {
    const line = buildMilestoneKm(signal, km);
    return {
      line,
      next: { ...state, lastTriggerAt: now, lastPace: signal.motion.paceKmh, lastKmAnnounced: km },
    };
  }

  const dPace = signal.motion.paceKmh - state.lastPace;
  if (dPace > 2.5 && signal.motion.paceKmh > 8) {
    const line = buildPaceSurge(signal);
    return { line, next: { ...state, lastTriggerAt: now, lastPace: signal.motion.paceKmh } };
  }
  if (dPace < -2.5 && state.lastPace > 5) {
    const line = buildPaceCrash(signal);
    return { line, next: { ...state, lastTriggerAt: now, lastPace: signal.motion.paceKmh } };
  }

  // Steady check-in roughly every 45s on slow cadence, 25s on hype 5.
  const cadence = Math.max(18000, 55000 - signal.hypeLevel * 7000);
  if (sinceLast > cadence) {
    const line = Math.random() < 0.4 ? buildSteady(signal) : buildCheckIn(signal);
    return { line, next: { ...state, lastTriggerAt: now, lastPace: signal.motion.paceKmh } };
  }

  return null;
}
