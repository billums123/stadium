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
    const script = coldOpenScript({
      athleteName: s.athleteName,
      motion: s.motion,
      lastTranscript: s.lastTranscript,
      lastTranscriptAgeMs: s.lastTranscriptAgeMs,
      elapsedInSessionMs: s.elapsedInSessionMs,
      hypeLevel: s.hypeFloor,
      career: s.career,
    });
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

  // Goal completion / failure announcements jump the queue.
  if (progress && !state.announcedGoalComplete && progress.status === "complete") {
    const line: Line = {
      trigger: "milestone-km",
      voice: "play",
      urgency: 3,
      text: `Goal complete. ${s.athleteName} hits the target.`,
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
      text: `Clock's gone. The goal eludes ${s.athleteName} — for now.`,
    };
    return pack(state, s, progress, "goal-failed", line, {
      tag: "[measured, sympathetic]",
      next: { ...state, lastTriggerAt: now, lastVoice: "color", announcedGoalFailed: true },
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

  // R4 — kilometre milestones.
  const km = Math.floor(s.motion.distanceMeters / 1000);
  if (km > state.lastKmAnnounced && km >= 1) {
    const line = buildMilestoneKm(asSig(s), km);
    return pack(state, s, progress, "milestone-km", line, {
      tag: "[shouting, triumphant]",
      next: {
        ...state,
        lastTriggerAt: now,
        lastPace: s.motion.paceKmh,
        lastVoice: "play",
        lastKmAnnounced: km,
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
  if (event === "pace-surge" || event === "milestone-km" || event === "goal-complete") score += 15;
  if (event === "cold-open") score = Math.max(score, 55);
  if (event === "color-aside" || event === "surroundings" || event === "weather") score = Math.max(20, Math.min(score, 50));
  if (event === "signoff") score = 70;

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
  const lines: string[] = [];
  lines.push(`Athlete: ${s.athleteName}`);
  lines.push(`Voice: ${voice === "play" ? "PLAY-BY-PLAY (primary, excitable)" : "COLOR COMMENTATOR (secondary, dry)"}`);
  lines.push(`Event: ${event}`);
  lines.push(`Intensity: ${intensity}/100`);
  if (tag) lines.push(`Preferred audio tag: ${tag}`);
  lines.push(`Pace: ${s.motion.paceKmh.toFixed(1)} km/h`);
  lines.push(`Distance covered: ${Math.round(s.motion.distanceMeters)} m`);
  lines.push(`Elapsed: ${Math.round(s.motion.elapsedMs / 1000)} s`);
  if (progress) {
    const m = progress.metersAhead;
    const lead =
      m > 2 ? `ahead by ${Math.round(m)} m` :
      m < -2 ? `behind by ${Math.round(-m)} m` :
      "on pace";
    lines.push(
      `Goal: ${Math.round(progress.goal.distanceMeters)} m in ${Math.round(progress.goal.timeMs / 1000)} s — currently ${lead}, ${(progress.distancePct * 100).toFixed(0)}% covered, ${Math.max(0, Math.round(progress.timeLeftMs / 1000))} s left, status "${progress.status}".`
    );
    if (progress.requiredKmh != null && Number.isFinite(progress.requiredKmh)) {
      lines.push(`Required finishing pace: ${progress.requiredKmh.toFixed(1)} km/h.`);
    }
  } else {
    lines.push("Goal: free run, no target.");
  }
  if (s.career.sessions > 0) {
    lines.push(
      `Career: broadcast #${s.career.sessions + 1}, ${s.career.totalKm.toFixed(1)} km lifetime, best pace ${s.career.bestPaceKmh.toFixed(1)} km/h.`
    );
  }
  if (s.lastTranscript) lines.push(`Last mic quote from the athlete: "${s.lastTranscript.slice(0, 140)}"`);

  lines.push("");
  lines.push("Write the next broadcast line. ONE or TWO short sentences. Under 30 words.");

  return { system, user: lines.join("\n") };
}

const SYSTEM_PROMPT = `You are a voice on STADIUM — a live AI sports broadcast for walks, runs, and bike rides. The athlete is an everyday person doing an everyday activity, and you are making it sound like a championship event.

Rules:
- Output exactly ONE line of commentary. ONE or TWO short sentences. Under 30 words total.
- Match the voice role you're given. PLAY-BY-PLAY is excitable, live, leaning into moments. COLOR COMMENTATOR is dry, wry, observational — think mid-fifties analyst who has seen it all.
- Tone is British-inflected, smart, occasionally absurdist. "Kilometres per hour", not "kph". Dry wit by default; crank the hype only on surges, milestones, final pushes, and goal completions.
- Use ElevenLabs v3 audio tags in brackets to shape delivery. Match the intensity score:
    intensity 70-100: [shouting], [ecstatic], [breathless], [urgent]
    intensity 40-70:  [excited], [confident], [warm], [driving]
    intensity 0-40:   [deadpan], [dry], [measured], [observational]
  Prefer the tag hinted in the user message when one is provided.
- Never break character. No disclaimers, no "as an AI", no apologies, no meta about writing a line.
- Do NOT quote the athlete unless the user message provides a mic quote to react to.
- Never output more than ONE line. Never output explanations. Never output surrounding quotes.
- Reference concrete things when they fit: the dog three houses back, the squirrel, the crowd, the scouts, the weather.
- When a goal is behind or in final-push, your words carry urgency — short sentences, punchy verbs. When ahead, earned calm. When complete, rip the roof off.

Output format:
[audio-tag] your single line here.`;
