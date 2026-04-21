/**
 * Permissions primer. Requests the browser permissions the broadcast
 * needs on first interaction, so the cold-open sequence doesn't get
 * interrupted by a prompt mid-countdown.
 *
 * Must be called inside a user gesture (iOS refuses otherwise).
 */

export type PermState = "prompt" | "granted" | "denied" | "unsupported";

export type PrimerReport = {
  motion: PermState;
  geolocation: PermState;
  /** true when everything we need is granted (motion + geo) */
  ready: boolean;
};

type DeviceMotionStatic = {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

/**
 * Request motion + geolocation permissions. Safe to call repeatedly;
 * already-granted permissions resolve immediately.
 */
export async function requestAllPermissions(): Promise<PrimerReport> {
  const report: PrimerReport = {
    motion: "unsupported",
    geolocation: "unsupported",
    ready: false,
  };

  // --- Geolocation (used for real pace, optional).
  if ("geolocation" in navigator) {
    report.geolocation = await new Promise<PermState>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve("granted"),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) resolve("denied");
          else resolve("prompt"); // timeout / position-unavailable — not a permission issue
        },
        { timeout: 3000, maximumAge: 10_000 }
      );
    });
  }

  // --- Motion / accelerometer (iOS 13+ gates DeviceMotionEvent behind
  // an explicit requestPermission() call inside a gesture).
  const dme = (globalThis as unknown as { DeviceMotionEvent?: DeviceMotionStatic })
    .DeviceMotionEvent;
  if (dme && typeof dme.requestPermission === "function") {
    try {
      const result = await dme.requestPermission();
      report.motion =
        result === "granted" ? "granted" : result === "denied" ? "denied" : "prompt";
    } catch {
      report.motion = "prompt";
    }
  } else if (typeof window !== "undefined" && "DeviceMotionEvent" in window) {
    // Android / desktop: no explicit grant needed.
    report.motion = "granted";
  }

  const motionOk = report.motion === "granted" || report.motion === "unsupported";
  const geoOk = report.geolocation === "granted" || report.geolocation === "unsupported";
  report.ready = motionOk && geoOk;
  return report;
}

const DONE_KEY = "stadium:perms:granted:v1";

export function markPrimerDone(report: PrimerReport) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify({ ts: Date.now(), ...report }));
  } catch { /* quota / private mode — fine */ }
}

export function wasPrimerDone(): boolean {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as Partial<PrimerReport>;
    const motionOk = data.motion === "granted" || data.motion === "unsupported";
    const geoOk = data.geolocation === "granted" || data.geolocation === "unsupported";
    return Boolean(motionOk && geoOk);
  } catch {
    return false;
  }
}
