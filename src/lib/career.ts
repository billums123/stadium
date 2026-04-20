/**
 * Lightweight career stats. Kept in localStorage, referenced by the
 * commentary engine for continuity between sessions. No UI surface —
 * the point is for the broadcast to *sound* like it remembers you.
 */

export type Career = {
  sessions: number;
  totalKm: number;
  bestPaceKmh: number;
  lastSessionAt: number; // epoch ms
};

const DEFAULT: Career = {
  sessions: 0,
  totalKm: 0,
  bestPaceKmh: 0,
  lastSessionAt: 0,
};

const KEY = "stadium:career:v1";

export function loadCareer(): Career {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<Career>) };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveCareer(c: Career) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* private browsing, quota, etc. — career is optional */
  }
}

/**
 * Merge a finished session's results into the persisted career state.
 */
export function recordSession(c: Career, sessionKm: number, peakKmh: number): Career {
  return {
    sessions: c.sessions + 1,
    totalKm: c.totalKm + sessionKm,
    bestPaceKmh: Math.max(c.bestPaceKmh, peakKmh),
    lastSessionAt: Date.now(),
  };
}
