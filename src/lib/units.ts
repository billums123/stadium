/**
 * Unit formatters. Internal representation stays SI (meters, km/h,
 * milliseconds) — these helpers only change how values are *rendered*
 * so the decision engine and goal math don't need to know about it.
 */

import { MILE_METERS } from "./goal";

export type UnitSystem = "metric" | "imperial";

/** Pace unit label ("km/h" vs "mph") for on-screen rendering. */
export function paceUnit(system: UnitSystem): string {
  return system === "imperial" ? "mph" : "km/h";
}

/** Short distance unit label (when distance ≥ 1 km / 1 mi) — "km" vs "mi". */
export function longDistanceUnit(system: UnitSystem): string {
  return system === "imperial" ? "mi" : "km";
}

/** Short distance label for sub-unit rendering ("m" vs "ft"). */
export function shortDistanceUnit(system: UnitSystem): string {
  return system === "imperial" ? "ft" : "m";
}

/**
 * Format a distance in metres for display. Picks small-unit vs
 * long-unit automatically with a sensible crossover:
 *   metric   < 1000 m → "350 m",          ≥ 1000 m → "3.2 km"
 *   imperial < 528 ft → "350 ft",         ≥ ~0.1 mi → "0.34 mi"
 */
export function formatDistance(meters: number, system: UnitSystem): string {
  if (system === "imperial") {
    const miles = meters / MILE_METERS;
    if (miles < 0.1) {
      const feet = meters * 3.28084;
      return `${Math.round(feet)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Format a pace in km/h for display. Converts to mph for imperial.
 */
export function formatPace(kmh: number, system: UnitSystem): string {
  const value = system === "imperial" ? kmh * 0.621371 : kmh;
  return `${value.toFixed(1)} ${paceUnit(system)}`;
}

/** Raw numeric pace value in the user's chosen unit (for math / charts). */
export function paceIn(kmh: number, system: UnitSystem): number {
  return system === "imperial" ? kmh * 0.621371 : kmh;
}

/** Raw numeric distance in the user's chosen unit (for math). */
export function distanceIn(meters: number, system: UnitSystem): number {
  return system === "imperial" ? meters / MILE_METERS : meters / 1000;
}

/** Phrase for TTS / LLM prompt — full word, British-inflected. */
export function paceUnitSpoken(system: UnitSystem): string {
  return system === "imperial" ? "miles per hour" : "kilometres per hour";
}

export function distanceUnitSpoken(system: UnitSystem, plural = true): string {
  if (system === "imperial") return plural ? "miles" : "mile";
  return plural ? "kilometres" : "kilometre";
}
