/**
 * Goal state — "run 0.25 miles in 90 seconds" — and the progress math
 * that tells the broadcast director how the athlete is doing against it.
 *
 * The director turns `GoalProgress` into director events like
 * "goal-approach", "falling-behind", "final-push".
 */

export type GoalUnit = "km" | "mi";

export type Goal = {
  distanceMeters: number;
  timeMs: number;
  unit: GoalUnit; // for display only; distanceMeters is authoritative
};

export const MILE_METERS = 1609.34;

/**
 * Goal presets keyed by the user's unit system. Presented in the UI as
 * clean rows that all speak the same language — a mi user never sees
 * a km preset, and vice versa. "Free run" is common to both.
 */
// Four presets per unit system — tilted toward short sprint-like
// efforts so the default UX is quick, high-intensity sessions that
// film well. Custom… below handles everything longer.
const IMPERIAL_PRESETS: Array<{ id: string; label: string; goal: Goal | null }> = [
  { id: "free", label: "Free run", goal: null },
  {
    id: "eighth-mi-40s",
    label: "⅛ mi · 40 s",
    goal: { distanceMeters: 0.125 * MILE_METERS, timeMs: 40_000, unit: "mi" },
  },
  {
    id: "quarter-mi-90s",
    label: "¼ mi · 90 s",
    goal: { distanceMeters: 0.25 * MILE_METERS, timeMs: 90_000, unit: "mi" },
  },
  {
    id: "mile-10min",
    label: "1 mi · 10 min",
    goal: { distanceMeters: MILE_METERS, timeMs: 600_000, unit: "mi" },
  },
];

const METRIC_PRESETS: Array<{ id: string; label: string; goal: Goal | null }> = [
  { id: "free", label: "Free run", goal: null },
  {
    id: "200m-40s",
    label: "200 m · 40 s",
    goal: { distanceMeters: 200, timeMs: 40_000, unit: "km" },
  },
  {
    id: "400m-90s",
    label: "400 m · 90 s",
    goal: { distanceMeters: 400, timeMs: 90_000, unit: "km" },
  },
  {
    id: "1km-6min",
    label: "1 km · 6 min",
    goal: { distanceMeters: 1000, timeMs: 360_000, unit: "km" },
  },
];

/**
 * Returns the preset list appropriate for the given unit system.
 * Back-compat: callers that want the legacy mixed list can import
 * `PRESET_GOALS` directly — it aliases the imperial list.
 */
export function presetGoalsFor(units: GoalUnit | "metric" | "imperial"): Array<{
  id: string;
  label: string;
  goal: Goal | null;
}> {
  const isImperial = units === "imperial" || units === "mi";
  return isImperial ? IMPERIAL_PRESETS : METRIC_PRESETS;
}

/** Legacy alias — same shape as before, defaults to the imperial set. */
export const PRESET_GOALS = IMPERIAL_PRESETS;

export type GoalStatus = "ahead" | "on-pace" | "behind" | "final-push" | "complete" | "failed";

export type GoalProgress = {
  goal: Goal;
  /** 0-1, covered distance as a fraction of target */
  distancePct: number;
  /** 0-1, elapsed time as a fraction of the time budget */
  timePct: number;
  /** positive = ahead (meters of cushion), negative = behind */
  metersAhead: number;
  /** required km/h to still finish on time (null if already done) */
  requiredKmh: number | null;
  /** ms of time remaining (may go negative once past the budget) */
  timeLeftMs: number;
  status: GoalStatus;
};

export function computeProgress(
  goal: Goal,
  elapsedMs: number,
  distanceMeters: number
): GoalProgress {
  const distancePct = Math.max(0, Math.min(1, distanceMeters / goal.distanceMeters));
  const timePct = Math.max(0, elapsedMs / goal.timeMs);
  const expectedMeters = goal.distanceMeters * Math.min(1, timePct);
  const metersAhead = distanceMeters - expectedMeters;
  const timeLeftMs = goal.timeMs - elapsedMs;
  const remainingMeters = Math.max(0, goal.distanceMeters - distanceMeters);
  const requiredKmh =
    remainingMeters === 0 ? null :
    timeLeftMs <= 0 ? Infinity :
    (remainingMeters / (timeLeftMs / 1000)) * 3.6;

  const status: GoalStatus =
    distancePct >= 1
      ? "complete"
      : timeLeftMs <= 0
      ? "failed"
      : distancePct > 0.8 && timeLeftMs < 20_000
      ? "final-push"
      : metersAhead > goal.distanceMeters * 0.05
      ? "ahead"
      : metersAhead < -goal.distanceMeters * 0.05
      ? "behind"
      : "on-pace";

  return {
    goal,
    distancePct,
    timePct,
    metersAhead,
    requiredKmh,
    timeLeftMs,
    status,
  };
}

/**
 * Format a goal's distance for display. Accepts either a GoalUnit
 * ("km"/"mi") or a global UnitSystem-style override ("metric"/
 * "imperial") — so call sites can pass `settings.units` directly.
 * Falls back to the goal's inherent unit when no override is given.
 */
export function formatGoalDistance(
  goal: Goal,
  override?: GoalUnit | "metric" | "imperial"
): string {
  const useImperial =
    override === "imperial" ||
    override === "mi" ||
    (!override && goal.unit === "mi");
  if (useImperial) {
    const mi = goal.distanceMeters / MILE_METERS;
    return mi === 1 ? "1 mile" : `${trimZeroes(mi)} miles`;
  }
  const km = goal.distanceMeters / 1000;
  return km >= 1 ? `${trimZeroes(km)} km` : `${Math.round(goal.distanceMeters)} m`;
}

export function formatGoalTime(goal: Goal): string {
  const s = Math.round(goal.timeMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${m} min` : `${m}m ${sec}s`;
}

function trimZeroes(n: number): string {
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, "");
}
