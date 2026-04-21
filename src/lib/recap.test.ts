import { describe, it, expect } from "vitest";
import { computeRecap, isRecapWorthy } from "./recap";
import type { MotionState } from "./motion";
import type { Goal, GoalProgress } from "./goal";

const motion = (over: Partial<MotionState> = {}): MotionState => ({
  distanceMeters: 0,
  elapsedMs: 0,
  paceKmh: 0,
  steps: 0,
  movementIntensity: 0,
  lat: null,
  lon: null,
  sourceGeo: false,
  sourceMotion: false,
  ...over,
});

const goalOf = (): Goal => ({ distanceMeters: 1000, timeMs: 360_000, unit: "km" });

const progress = (over: Partial<GoalProgress>): GoalProgress => ({
  goal: goalOf(),
  distancePct: 0,
  timePct: 0,
  metersAhead: 0,
  requiredKmh: null,
  timeLeftMs: 0,
  status: "on-pace",
  ...over,
});

describe("computeRecap", () => {
  it("computes avg pace as distance / elapsed, not a rolling mean", () => {
    const r = computeRecap("Tanner", motion({ distanceMeters: 1000, elapsedMs: 300_000 }), 15, 80, null);
    // 1 km in 5 min = 12 km/h
    expect(r.avgKmh).toBeCloseTo(12, 1);
  });

  it("handles zero-elapsed sessions without dividing by zero", () => {
    const r = computeRecap("Tanner", motion({ distanceMeters: 0, elapsedMs: 0 }), 0, 0, null);
    expect(r.avgKmh).toBe(0);
    expect(r.totalDistanceM).toBe(0);
  });

  it("reports goalOutcome=complete when the goal progress says so", () => {
    const r = computeRecap(
      "Tanner",
      motion({ distanceMeters: 1100, elapsedMs: 300_000 }),
      15,
      92,
      progress({ status: "complete", distancePct: 1.1 })
    );
    expect(r.goalOutcome).toBe("complete");
    expect(r.goal?.distanceMeters).toBe(1000);
  });

  it("reports goalOutcome=failed when the clock ran out before distance hit", () => {
    const r = computeRecap(
      "Tanner",
      motion({ distanceMeters: 700, elapsedMs: 360_000 }),
      11,
      55,
      progress({ status: "failed", distancePct: 0.7, timeLeftMs: -5000 })
    );
    expect(r.goalOutcome).toBe("failed");
  });

  it("treats mid-goal stop as failed (user stopped early)", () => {
    const r = computeRecap(
      "Tanner",
      motion({ distanceMeters: 400, elapsedMs: 120_000 }),
      9,
      40,
      progress({ status: "on-pace", distancePct: 0.4, timeLeftMs: 240_000 })
    );
    expect(r.goalOutcome).toBe("failed");
  });

  it("reports goalOutcome=none when there was no goal", () => {
    const r = computeRecap("Tanner", motion({ distanceMeters: 500, elapsedMs: 120_000 }), 8, 35, null);
    expect(r.goalOutcome).toBe("none");
  });

  it("rounds peakHype and floors the negatives", () => {
    const r = computeRecap("Tanner", motion({ distanceMeters: 100, elapsedMs: 30_000 }), 5, 72.7, null);
    expect(r.peakHype).toBe(73);
    const clamped = computeRecap("Tanner", motion(), -5, -10, null);
    expect(clamped.peakHype).toBe(0);
    expect(clamped.peakKmh).toBe(0);
  });

  it("falls back to 'THE ATHLETE' when name is empty", () => {
    const r = computeRecap("", motion({ distanceMeters: 10, elapsedMs: 5000 }), 1, 5, null);
    expect(r.athleteName).toBe("THE ATHLETE");
  });
});

describe("isRecapWorthy", () => {
  it("is true when distance ≥ 30 m", () => {
    expect(isRecapWorthy(motion({ distanceMeters: 30 }))).toBe(true);
    expect(isRecapWorthy(motion({ distanceMeters: 29 }))).toBe(false);
  });
  it("is true when elapsed ≥ 20 s", () => {
    expect(isRecapWorthy(motion({ elapsedMs: 20_000 }))).toBe(true);
    expect(isRecapWorthy(motion({ elapsedMs: 19_999 }))).toBe(false);
  });
  it("is false for a single tap that went nowhere", () => {
    expect(isRecapWorthy(motion({ distanceMeters: 2, elapsedMs: 1500 }))).toBe(false);
  });
});
