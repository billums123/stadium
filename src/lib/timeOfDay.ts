/**
 * Small helpers for time-of-day framing — keeps the HUD labels in sync
 * with the spoken cold-open (`coldOpenScript` in commentary.ts).
 */

export type Slot = "morning" | "today" | "tonight";

export function currentSlot(now: Date = new Date()): Slot {
  const h = now.getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "today";
  return "tonight";
}

/** Possessive used as a HUD label prefix: "MORNING'S GOAL" / "TODAY'S ATHLETE" / "TONIGHT'S GOAL". */
export function possessiveSlot(now: Date = new Date()): string {
  switch (currentSlot(now)) {
    case "morning":
      return "MORNING'S";
    case "today":
      return "TODAY'S";
    default:
      return "TONIGHT'S";
  }
}
