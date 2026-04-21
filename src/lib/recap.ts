/**
 * Post-session recap — pure helpers. Takes frozen session state at
 * stop-time and computes the numbers the `RecapScreen` displays.
 *
 * Implements tasks 3–5 from .kiro/specs/session-recap/tasks.md.
 */

import type { MotionState } from "./motion";
import type { Line } from "./commentary";
import type { Goal, GoalProgress } from "./goal";

/** R4 — the snapshot the recap screen reads. */
export type RecapSnapshot = {
  athleteName: string;
  totalTimeMs: number;
  totalDistanceM: number;
  peakKmh: number;
  avgKmh: number;
  peakHype: number;
  goalOutcome: "complete" | "failed" | "none";
  /** The snapshotted goal, so the share card can render "¼ mi · 90 s" */
  goal: Goal | null;
  /** Filled in after the closing LLM call resolves. */
  closingLine: Line | null;
};

/**
 * R4 / R5 / R6 — compute the recap from end-of-session state.
 *
 * @param athleteName  display name for the athlete
 * @param motion       final MotionState (tracker already stopped)
 * @param peakKmh      highest instantaneous pace observed
 * @param peakHype     highest intensity score observed
 * @param progress     final goal progress if a goal was set, else null
 */
export function computeRecap(
  athleteName: string,
  motion: MotionState,
  peakKmh: number,
  peakHype: number,
  progress: GoalProgress | null
): RecapSnapshot {
  // R5 — average pace from the ratio, not a running mean of instant
  // readings (GPS jitter would otherwise inflate it).
  const elapsedSec = motion.elapsedMs / 1000;
  const avgKmh = elapsedSec > 0 ? (motion.distanceMeters / elapsedSec) * 3.6 : 0;

  let outcome: RecapSnapshot["goalOutcome"] = "none";
  if (progress) {
    if (progress.status === "complete") outcome = "complete";
    else if (progress.status === "failed") outcome = "failed";
    else {
      // Still mid-goal when the user stopped — treat as failed for
      // recap purposes so the UI has a definite answer to show.
      outcome = progress.distancePct >= 1 ? "complete" : "failed";
    }
  }

  return {
    athleteName: athleteName || "THE ATHLETE",
    totalTimeMs: motion.elapsedMs,
    totalDistanceM: motion.distanceMeters,
    peakKmh: Math.max(0, peakKmh),
    avgKmh: Math.max(0, avgKmh),
    peakHype: Math.max(0, Math.round(peakHype)),
    goalOutcome: outcome,
    goal: progress?.goal ?? null,
    closingLine: null,
  };
}

/**
 * R1 thresholds — a session only produces a recap if it covered real
 * ground. Too-short sessions skip the recap screen and go straight
 * back to landing (and don't pollute career stats).
 */
export function isRecapWorthy(motion: MotionState): boolean {
  return motion.distanceMeters >= 30 || motion.elapsedMs >= 20_000;
}
