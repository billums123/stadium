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
const YARD_METERS = 0.9144;

// Four presets per unit system, structured as dash → sprint → push
// distance. Sprint labels use yards / metres because that's how a dash
// is normally framed — "100 yd" parses as a football field, where
// "⅛ mi" parses as maths. Custom… handles anything longer than a mile.
const IMPERIAL_PRESETS: Array<{ id: string; label: string; goal: Goal | null }> = [
  { id: "free", label: "Free run", goal: null },
  {
    id: "40yd-8s",
    label: "40 yd · 8 s",
    goal: { distanceMeters: 40 * YARD_METERS, timeMs: 8_000, unit: "mi" },
  },
  {
    id: "100yd-20s",
    label: "100 yd · 20 s",
    goal: { distanceMeters: 100 * YARD_METERS, timeMs: 20_000, unit: "mi" },
  },
  {
    id: "quarter-mi-90s",
    label: "¼ mi · 90 s",
    goal: { distanceMeters: 0.25 * MILE_METERS, timeMs: 90_000, unit: "mi" },
  },
];

const METRIC_PRESETS: Array<{ id: string; label: string; goal: Goal | null }> = [
  { id: "free", label: "Free run", goal: null },
  {
    id: "40m-8s",
    label: "40 m · 8 s",
    goal: { distanceMeters: 40, timeMs: 8_000, unit: "km" },
  },
  {
    id: "100m-20s",
    label: "100 m · 20 s",
    goal: { distanceMeters: 100, timeMs: 20_000, unit: "km" },
  },
  {
    id: "400m-90s",
    label: "400 m · 90 s",
    goal: { distanceMeters: 400, timeMs: 90_000, unit: "km" },
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
  /** Remaining distance in metres (clamped at 0 once finished). */
  remainingMeters: number;
  /** True in the final stretch — whichever is larger of 15 m or 5%
   *  of goal distance. Used to crank audio + fire final-dash events. */
  dashToFinish: boolean;
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

  const dashThreshold = Math.max(15, 0.05 * goal.distanceMeters);
  const dashToFinish = distancePct < 1 && remainingMeters <= dashThreshold;

  return {
    goal,
    distancePct,
    timePct,
    metersAhead,
    requiredKmh,
    timeLeftMs,
    status,
    remainingMeters,
    dashToFinish,
  };
}

/**
 * Format a goal's distance for display. Accepts either a GoalUnit
 * ("km"/"mi") or a global UnitSystem-style override ("metric"/
 * "imperial") — so call sites can pass `settings.units` directly.
 * Falls back to the goal's inherent unit when no override is given.
 *
 * Short-distance handling: imperial goals under 0.1 mi render in
 * yards ("100 yd") instead of a useless "0.06 miles". Metric already
 * flips to meters under 1 km.
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
    if (mi < 0.1) {
      const yards = goal.distanceMeters / 0.9144;
      return `${Math.round(yards)} yd`;
    }
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
