/**
 * Tactile feedback. `navigator.vibrate` is Android-friendly but a
 * no-op on iOS Safari; we still call it so devices that support it
 * get the thud without a feature check at every call site.
 *
 * Keep patterns short (<60ms) for UI taps. Longer patterns are
 * reserved for big moments (goal complete, broadcast start).
 */

type Pattern = number | number[];

type HapticKind =
  | "tap"       // generic select / chip
  | "press"     // primary button press (GO / STOP / HYPE)
  | "success"   // goal complete, PR
  | "ambient"   // subtle — milestone / pace-surge flash
  | "fail";     // goal failed / error

const PATTERNS: Record<HapticKind, Pattern> = {
  tap: 10,
  press: 22,
  success: [20, 40, 20, 40, 60],
  ambient: [8, 40, 8],
  fail: [30, 80, 30],
};

export function haptic(kind: HapticKind): void {
  try {
    (navigator as Navigator & { vibrate?: (p: Pattern) => boolean }).vibrate?.(PATTERNS[kind]);
  } catch {
    /* no-op */
  }
}
