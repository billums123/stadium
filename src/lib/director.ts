/**
 * The broadcast director. Sits between the motion/speech/goal state and
 * whatever voice pipeline produces a line. It:
 *
 *   1. Classifies the moment into an `Event` (surge, milestone,
 *      goal-approach, falling-behind, final-push, quote, …).
 *   2. Computes a `0..100` intensity score so downstream TTS / audio
 *      playback can match the energy — faster speech on a surge,
 *      whisper register on a steady beat.
 *   3. Builds a system + user prompt for the LLM when dynamic mode
 *      is available. The template engine remains the fallback.
 *
 * Keep this module pure. Anything that touches React, audio, timers,
 * or fetch belongs in `useBroadcast`.
 */

import type { MotionState } from "./motion";
import type { GoalProgress } from "./goal";
import { computeProgress, type Goal } from "./goal";
import type { UnitSystem } from "./units";
import { paceIn, paceUnitSpoken } from "./units";
import {
  buildOpening,
  buildQuote,
  buildPaceSurge,
  buildPaceCrash,
  buildSteady,
  buildMilestoneKm,
  buildCheckIn,
  buildSurroundings,
  buildWeather,
  buildFinishStrong,
  buildColorAside,
  coldOpenScript,
  type Line,
  type Voice,
} from "./commentary";
import type { Career } from "./career";

export type DirectorSignal = {
  athleteName: string;
  motion: MotionState;
  lastTranscript: string | null;
  lastTranscriptAgeMs: number;
  elapsedInSessionMs: number;
  hypeFloor: number; // 1-5 user floor
  career: Career;
  goal: Goal | null;
  units: UnitSystem;
};

export type Event =
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
  | "goal-approach"
  | "goal-behind"
  | "goal-final-push"
  | "goal-final-dash"
  | "goal-complete"
  | "goal-failed"
  | "color-aside"
  | "signoff";

export type DirectorState = {
  coldOpenIndex: number;
  hasOpened: boolean;
  lastTriggerAt: number;
  lastPace: number;
  lastKmAnnounced: number;
  interludeCount: number;
  lastVoice: Voice | null;
  announcedGoalComplete: boolean;
  announcedGoalFailed: boolean;
  announcedFinalDash: boolean;
};

export const INITIAL_DIRECTOR: DirectorState = {
  coldOpenIndex: 0,
  hasOpened: false,
  lastTriggerAt: -999_999,
  lastPace: 0,
  lastKmAnnounced: 0,
  interludeCount: 0,
  lastVoice: null,
  announcedGoalComplete: false,
  announcedGoalFailed: false,
  announcedFinalDash: false,
};

export type DirectorPlan = {
  event: Event;
  voice: Voice;
  urgency: 1 | 2 | 3;
  /** 0-100. Higher = faster, louder, more style in the TTS call. */
  intensity: number;
  /** Optional audio-tag hint for Eleven v3 style delivery. */
  tag?: string;
  next: DirectorState;
  /** Fallback line produced from the template engine. Used if the LLM
   *  call fails; also used when `useDynamic` is false. */
  fallbackLine: Line;
  /** Pre-built LLM prompts. Empty user string if the event has no LLM
   *  variant (e.g. cold-open plays a fixed script). */
  prompts: { system: string; user: string } | null;
};

const COOLDOWN_DEFAULT_MS = 12_000;

/** Classify the moment and produce the plan. */
export function plan(
  state: DirectorState,
  s: DirectorSignal,
  lastLine: Line | null
): DirectorPlan | null {
  const now = s.elapsedInSessionMs;
  const sinceLast = now - state.lastTriggerAt;
  const progress = s.goal
    ? computeProgress(s.goal, s.motion.elapsedMs, s.motion.distanceMeters)
    : null;

  // R1 — cold-open plays the fixed script before the reactive engine starts.
  if (state.coldOpenIndex >= 0) {
    const script = coldOpenScript(asSig(s));
    const line = script[state.coldOpenIndex];
    const done = state.coldOpenIndex + 1 >= script.length;
    return {
      event: "cold-open",
      voice: line.voice,
      urgency: line.urgency,
      intensity: computeIntensity(s, progress, "cold-open"),
      tag: line.voice === "color" ? "[deadpan, measured]" : "[warm, broadcast-ready]",
      next: {
        ...state,
        coldOpenIndex: done ? -1 : state.coldOpenIndex + 1,
        hasOpened: done ? true : state.hasOpened,
        lastTriggerAt: now,
        lastVoice: line.voice,
      },
      fallbackLine: line,
      prompts: null, // cold-open is deterministic for theatrical effect
    };
  }

  if (!state.hasOpened) {
    const line = buildOpening(asSig(s));
    return pack(state, s, progress, "opening", line, {
      tag: "[confident, warm]",
      next: { ...state, hasOpened: true, lastTriggerAt: now, lastVoice: line.voice, lastPace: s.motion.paceKmh },
    });
  }

  // Goal completion / failure / dash announcements jump the queue.
  if (progress && !state.announcedGoalComplete && progress.status === "complete") {
    const line: Line = {
      trigger: "milestone-km",
      voice: "play",
      urgency: 3,
      text: `${s.athleteName} hits it. Goal.`,
    };
    return pack(state, s, progress, "goal-complete", line, {
      tag: "[shouting, ecstatic]",
      next: { ...state, lastTriggerAt: now, lastVoice: "play", announcedGoalComplete: true },
    });
  }
  if (progress && !state.announcedGoalFailed && progress.status === "failed") {
    const line: Line = {
      trigger: "check-in",
      voice: "color",
      urgency: 2,
      text: `Clock's gone. No shame.`,
    };
    return pack(state, s, progress, "goal-failed", line, {
      tag: "[measured, sympathetic]",
      next: { ...state, lastTriggerAt: now, lastVoice: "color", announcedGoalFailed: true },
    });
  }
  // Final-dash — last ~5% / 15m before the finish. Fires exactly
  // once, ignores cooldown, punchy short line.
  if (progress && progress.dashToFinish && !state.announcedFinalDash) {
    const remaining = formatRemainingShort(progress.remainingMeters, s.units);
    const line: Line = {
      trigger: "finish-strong",
      voice: "play",
      urgency: 3,
      text: `${remaining}! Here it comes!`,
    };
    return pack(state, s, progress, "goal-final-dash", line, {
      tag: "[shouting, breathless]",
      next: { ...state, lastTriggerAt: now, lastVoice: "play", announcedFinalDash: true },
    });
  }

  // R5 — quote takes priority when a fresh transcript arrives.
  if (s.lastTranscript && s.lastTranscriptAgeMs < 2500 && sinceLast > 6000) {
    const line = buildQuote(asSig(s));
    return pack(state, s, progress, "quote", line, {
      tag: "[intrigued, leaning-in]",
      next: { ...state, lastTriggerAt: now, lastVoice: "play", lastPace: s.motion.paceKmh },
    });
  }

  // Two-voice dialog: after a play-by-play beat, color voice gets a short turn.
  if (
    lastLine &&
    lastLine.voice === "play" &&
    state.lastVoice === "play" &&
    sinceLast > 4500 &&
    sinceLast < COOLDOWN_DEFAULT_MS &&
    Math.random() < 0.55
  ) {
    const line = buildColorAside(asSig(s), lastLine);
    return pack(state, s, progress, "color-aside", line, {
      tag: "[dry, wry]",
      next: { ...state, lastTriggerAt: now, lastVoice: "color" },
    });
  }

  if (sinceLast < COOLDOWN_DEFAULT_MS) return null;

  // Goal-urgent states take priority over plain pace events.
  if (progress) {
    if (progress.status === "final-push") {
      const line: Line = {
        ...buildFinishStrong(asSig(s)),
        text: buildFinishStrong(asSig(s)).text, // keep as fallback
      };
      return pack(state, s, progress, "goal-final-push", line, {
        tag: "[breathless, urgent]",
        next: { ...state, lastTriggerAt: now, lastPace: s.motion.paceKmh, lastVoice: line.voice },
      });
    }
    if (progress.status === "behind" && progress.timeLeftMs > 0 && progress.timeLeftMs < 30_000) {
      const line: Line = {
        trigger: "check-in",
        voice: "play",
        urgency: 2,
        text: `Behind by ${Math.max(1, Math.round(-progress.metersAhead))} metres. The clock does not care.`,
      };
      return pack(state, s, progress, "goal-behind", line, {
        tag: "[focused, pressed]",
        next: { ...state, lastTriggerAt: now, lastPace: s.motion.paceKmh, lastVoice: "play" },
      });
    }
    if (progress.status === "ahead" && Math.random() < 0.4) {
      const line: Line = {
        trigger: "check-in",
        voice: "play",
        urgency: 2,
        text: `${Math.round(progress.metersAhead)} metres of cushion. ${s.athleteName} can afford a smile. Not yet though.`,
      };
      return pack(state, s, progress, "goal-approach", line, {
        tag: "[confident, bright]",
        next: { ...state, lastTriggerAt: now, lastPace: s.motion.paceKmh, lastVoice: "play" },
      });
    }
  }

  // R4 — distance milestones. Count whole kilometres in metric,
  // whole miles in imperial, so the commentator announces milestones
  // in the athlete's preferred unit.
  const unitMeters = s.units === "imperial" ? 1609.34 : 1000;
  const reached = Math.floor(s.motion.distanceMeters / unitMeters);
  if (reached > state.lastKmAnnounced && reached >= 1) {
    const line = buildMilestoneKm(asSig(s), reached);
    return pack(state, s, progress, "milestone-km", line, {
      tag: "[shouting, triumphant]",
      next: {
        ...state,
        lastTriggerAt: now,
        lastPace: s.motion.paceKmh,
        lastVoice: "play",
        lastKmAnnounced: reached,
      },
    });
  }

  // R3 — pace dynamics.
  const dPace = s.motion.paceKmh - state.lastPace;
  if (dPace > 2.5 && s.motion.paceKmh > 8) {
    const line = buildPaceSurge(asSig(s));
    return pack(state, s, progress, "pace-surge", line, {
      tag: "[excited, breathless]",
      next: { ...state, lastTriggerAt: now, lastPace: s.motion.paceKmh, lastVoice: "play" },
    });
  }
  if (dPace < -2.5 && state.lastPace > 5) {
    const line = buildPaceCrash(asSig(s));
    return pack(state, s, progress, "pace-crash", line, {
      tag: "[concerned, measured]",
      next: { ...state, lastTriggerAt: now, lastPace: s.motion.paceKmh, lastVoice: "play" },
    });
  }

  // R2 — cadence-driven fillers with flavour rotation.
  const cadence = Math.max(12_000, 42_000 - s.hypeFloor * 5_000);
  if (sinceLast > cadence) {
    const ev = pickFillerEvent(state, s);
    const line = fillerLine(ev, asSig(s));
    return pack(state, s, progress, ev, line, {
      tag: tagForEvent(ev),
      next: {
        ...state,
        lastTriggerAt: now,
        lastPace: s.motion.paceKmh,
        lastVoice: line.voice,
        interludeCount: state.interludeCount + 1,
      },
    });
  }

  return null;
}

function pickFillerEvent(state: DirectorState, s: DirectorSignal): Event {
  const idx = state.interludeCount;
  if (idx > 0 && idx % 3 === 0) return "surroundings";
  if (idx > 0 && idx % 5 === 0) return "weather";
  if (s.motion.elapsedMs > 20 * 60 * 1000 && Math.random() < 0.3) return "finish-strong";
  return Math.random() < 0.45 ? "steady" : "check-in";
}

function fillerLine(ev: Event, sig: ReturnType<typeof asSig>): Line {
  switch (ev) {
    case "surroundings":  return buildSurroundings(sig);
    case "weather":       return buildWeather(sig);
    case "finish-strong": return buildFinishStrong(sig);
    case "check-in":      return buildCheckIn(sig);
    default:              return buildSteady(sig);
  }
}

function tagForEvent(ev: Event): string | undefined {
  switch (ev) {
    case "surroundings":  return "[observational, dry]";
    case "weather":       return "[matter-of-fact]";
    case "finish-strong": return "[urgent, driving]";
    case "check-in":      return "[warm, attentive]";
    case "steady":        return "[calm, metronomic]";
    default:              return undefined;
  }
}

/**
 * Tight distance-remaining phrase for an urgent line. Drops units
 * to stay punchy: "10 yards", "5 metres", "30 feet".
 */
function formatRemainingShort(meters: number, units: UnitSystem): string {
  if (units === "imperial") {
    if (meters < 18) {
      const feet = Math.max(1, Math.round(meters * 3.28084));
      return `${feet} feet`;
    }
    const yards = Math.max(1, Math.round(meters / 0.9144));
    return `${yards} yards`;
  }
  const m = Math.max(1, Math.round(meters));
  return `${m} metres`;
}

/** Map internal state to a legacy `Signal` for the template engine. */
function asSig(s: DirectorSignal) {
  return {
    athleteName: s.athleteName,
    motion: s.motion,
    lastTranscript: s.lastTranscript,
    lastTranscriptAgeMs: s.lastTranscriptAgeMs,
    elapsedInSessionMs: s.elapsedInSessionMs,
    hypeLevel: s.hypeFloor,
    career: s.career,
    units: s.units,
  };
}

/**
 * Score 0..100. Combines user-set hype floor with reactive signals
 * (pace, goal pressure, pace delta). Capped so even a walk can reach
 * 20 if the hype floor is cranked and a goal is at the wire.
 */
export function computeIntensity(
  s: DirectorSignal,
  progress: GoalProgress | null,
  event: Event
): number {
  let score = (s.hypeFloor - 1) * 10; // 0..40 floor

  // Pace band
  const kmh = s.motion.paceKmh;
  if (kmh > 16) score += 45;
  else if (kmh > 11) score += 35;
  else if (kmh > 7) score += 22;
  else if (kmh > 4) score += 10;

  // Goal pressure
  if (progress) {
    if (progress.status === "final-push") score += 20;
    if (progress.status === "behind" && progress.timeLeftMs < 30_000) score += 15;
    if (progress.status === "complete") score = 100;
    if (progress.status === "failed") score = Math.min(score, 40);
  }

  // Event modifiers
  if (event === "pace-surge" || event === "milestone-km") score += 15;
  if (event === "cold-open") score = Math.max(score, 55);
  if (event === "color-aside" || event === "surroundings" || event === "weather") score = Math.max(20, Math.min(score, 50));
  if (event === "signoff") score = 70;
  if (event === "goal-final-dash") score = 95;
  if (event === "goal-complete") score = 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function pack(
  _state: DirectorState,
  s: DirectorSignal,
  progress: GoalProgress | null,
  event: Event,
  fallbackLine: Line,
  extras: { tag?: string; next: DirectorState }
): DirectorPlan {
  const intensity = computeIntensity(s, progress, event);
  return {
    event,
    voice: fallbackLine.voice,
    urgency: fallbackLine.urgency,
    intensity,
    tag: extras.tag,
    next: extras.next,
    fallbackLine,
    prompts: buildPrompts(s, progress, event, fallbackLine.voice, intensity, extras.tag),
  };
}

/**
 * Build the LLM prompts. System prompt holds tone guardrails; the user
 * prompt is the machine-readable moment snapshot.
 */
function buildPrompts(
  s: DirectorSignal,
  progress: GoalProgress | null,
  event: Event,
  voice: Voice,
  intensity: number,
  tag?: string
): { system: string; user: string } {
  const system = SYSTEM_PROMPT;
  const unitPhrase = paceUnitSpoken(s.units);
  const lines: string[] = [];
  lines.push(`Athlete: ${s.athleteName}`);
  lines.push(`Voice: ${voice === "play" ? "PLAY-BY-PLAY (primary, excitable)" : "COLOR COMMENTATOR (secondary, dry)"}`);
  lines.push(`Event: ${event}`);
  lines.push(`Intensity: ${intensity}/100`);
  lines.push(`Preferred units: ${s.units} — when speaking about pace, use "${unitPhrase}", never switch systems mid-line.`);
  if (tag) lines.push(`Preferred audio tag: ${tag}`);
  lines.push(`Pace: ${paceIn(s.motion.paceKmh, s.units).toFixed(1)} ${unitPhrase}`);
  const distMetric = s.units === "imperial" ? "miles" : "kilometres";
  const distValue = s.units === "imperial"
    ? (s.motion.distanceMeters / 1609.34).toFixed(2)
    : (s.motion.distanceMeters / 1000).toFixed(2);
  lines.push(`Distance covered: ${distValue} ${distMetric}`);
  lines.push(`Elapsed: ${Math.round(s.motion.elapsedMs / 1000)} s`);
  if (progress) {
    const m = progress.metersAhead;
    const leadUnit = s.units === "imperial" ? 0.3048 : 1; // ~ft vs m
    const leadLabel = s.units === "imperial" ? "ft" : "m";
    const lead =
      m > 2 ? `ahead by ${Math.round(m / leadUnit)} ${leadLabel}` :
      m < -2 ? `behind by ${Math.round(-m / leadUnit)} ${leadLabel}` :
      "on pace";
    const goalDistValue = s.units === "imperial"
      ? (progress.goal.distanceMeters / 1609.34).toFixed(2)
      : (progress.goal.distanceMeters / 1000).toFixed(2);
    lines.push(
      `Goal: ${goalDistValue} ${distMetric} in ${Math.round(progress.goal.timeMs / 1000)} s — currently ${lead}, ${(progress.distancePct * 100).toFixed(0)}% covered, ${Math.max(0, Math.round(progress.timeLeftMs / 1000))} s left, status "${progress.status}".`
    );
    if (progress.requiredKmh != null && Number.isFinite(progress.requiredKmh)) {
      lines.push(`Required finishing pace: ${paceIn(progress.requiredKmh, s.units).toFixed(1)} ${unitPhrase}.`);
    }
  } else {
    lines.push("Goal: free run, no target.");
  }
  if (s.career.sessions > 0) {
    const lifetime = s.units === "imperial"
      ? `${(s.career.totalKm * 0.621371).toFixed(1)} mi`
      : `${s.career.totalKm.toFixed(1)} km`;
    const bestPace = `${paceIn(s.career.bestPaceKmh, s.units).toFixed(1)} ${unitPhrase}`;
    lines.push(`Career: broadcast #${s.career.sessions + 1}, ${lifetime} lifetime, best pace ${bestPace}.`);
  }

  lines.push("");
  // Let the system prompt enforce the per-event word budget — this
  // just reminds the model to keep it tight.
  lines.push("Write the next broadcast line. Keep it punchy.");

  return { system, user: lines.join("\n") };
}

/**
 * session-recap spec R7 / R8 — prompt builder for the closing line
 * that runs on stop. Not routed through `plan()` because the recap
 * has no cooldown / interlude logic; it's a single shot.
 */
export function buildRecapPrompts(opts: {
  athleteName: string;
  outcome: "complete" | "failed" | "none";
  totalDistanceM: number;
  totalTimeMs: number;
  peakKmh: number;
  avgKmh: number;
  peakHype: number;
  careerAfterSessions: number;
  careerAfterTotalKm: number;
  units: UnitSystem;
}): { system: string; user: string } {
  const system = SYSTEM_PROMPT;
  const unitPhrase = paceUnitSpoken(opts.units);
  const distName = opts.units === "imperial" ? "miles" : "kilometres";
  const dist = opts.units === "imperial"
    ? (opts.totalDistanceM / 1609.34).toFixed(2)
    : (opts.totalDistanceM / 1000).toFixed(2);
  const mins = Math.max(1, Math.round(opts.totalTimeMs / 60_000));
  const lines: string[] = [];
  lines.push(`Athlete: ${opts.athleteName}`);
  lines.push(`Voice: PLAY-BY-PLAY (primary, excitable)`);
  lines.push(`Event: session-recap`);
  lines.push(`Preferred units: ${opts.units} — pace as "${unitPhrase}", distance as "${distName}".`);
  lines.push(`Goal outcome: ${opts.outcome}`);
  lines.push(`Total distance: ${dist} ${distName}`);
  lines.push(`Total time: ${mins} min`);
  lines.push(`Peak pace: ${paceIn(opts.peakKmh, opts.units).toFixed(1)} ${unitPhrase}`);
  lines.push(`Avg pace: ${paceIn(opts.avgKmh, opts.units).toFixed(1)} ${unitPhrase}`);
  lines.push(`Peak hype: ${opts.peakHype}/100`);
  const lifetime = opts.units === "imperial"
    ? `${(opts.careerAfterTotalKm * 0.621371).toFixed(1)} ${distName}`
    : `${opts.careerAfterTotalKm.toFixed(1)} ${distName}`;
  lines.push(
    `Career after this session: #${opts.careerAfterSessions}, ${lifetime} lifetime`
  );
  lines.push(
    opts.outcome === "complete"
      ? `Preferred audio tag: [triumphant, warm]`
      : opts.outcome === "failed"
      ? `Preferred audio tag: [measured, respectful]`
      : `Preferred audio tag: [warm, broadcast-ready]`
  );
  lines.push("");
  lines.push(
    "Write the closing broadcast line. ONE or TWO short sentences, under 25 words, tighter is better. Reference the actual numbers — the distance, the time, or the pace. If the goal was hit, sound earned (not loud). If failed, be generous and set up the rematch. If there was no goal, celebrate the act of showing up. Do not say 'live' or 'we are underway' — the session is over."
  );
  return { system, user: lines.join("\n") };
}

const SYSTEM_PROMPT = `You are a voice on STADIUM — a live AI sports broadcast for walks, runs, and bike rides. The athlete is an everyday person doing an everyday activity, and you are making it sound like a championship event.

Rules:
- Output exactly ONE line of commentary. ONE short sentence by default. At most two. Under 20 words total by default.
- Word budget by event:
    goal-final-dash: 4-10 words. Short. Clipped. Urgent.
    goal-complete:   4-8 words. All-caps energy, no full sentence needed.
    pace-surge / milestone / finish-strong: up to 18 words.
    everything else: 10-18 words, the tighter the better.
- Match the voice role you're given. PLAY-BY-PLAY is excitable, live, leaning into moments. COLOR COMMENTATOR is dry, wry, observational — think mid-fifties analyst who has seen it all.
- Tone is British-inflected, smart, occasionally absurdist. Say pace units in full words ("kilometres per hour" or "miles per hour", per the preferred-units line in the user message) — never "kph" or "kmh" or "mph" as letters. Dry wit by default; crank the hype only on surges, milestones, final dashes, and goal completions.
- Use ElevenLabs v3 audio tags in brackets to shape delivery. Match the intensity score:
    intensity 85-100: [shouting], [ecstatic], [breathless]
    intensity 50-85:  [excited], [confident], [warm], [driving]
    intensity 0-50:   [deadpan], [dry], [measured], [observational]
  Prefer the tag hinted in the user message when one is provided.
- Never break character. No disclaimers, no "as an AI", no apologies, no meta about writing a line.
- Never output more than ONE line. Never output explanations. Never output surrounding quotes.
- Reference concrete things when they fit: the dog three houses back, the squirrel, the crowd, the scouts, the weather.
- On final-dash: NO hedging, NO setup, just the finish-line urgency. Example: "Five yards! Hold it!" or "Metres away! Now!"
- On goal-complete: PUNCHY. No sentence needed. Example: "YES. On the nose." or "Goal. Banked."

Output format:
[audio-tag] your single line here.`;
