/**
 * Permissions primer. Requests every browser permission the broadcast
 * needs on first interaction, so the cold-open sequence doesn't get
 * interrupted by a prompt mid-countdown.
 *
 * Must be called inside a user gesture (iOS refuses otherwise).
 */

export type PermState = "prompt" | "granted" | "denied" | "unsupported";

export type PrimerReport = {
  microphone: PermState;
  motion: PermState;
  geolocation: PermState;
  /** true when everything we need is granted */
  ready: boolean;
};

type DeviceMotionStatic = {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

/**
 * Request broadcast permissions. Safe to call repeatedly; already-
 * granted permissions resolve immediately. Mic is off by default
 * because opening it engages Acoustic Echo Cancellation on all
 * output, which degrades the TTS playback quality on phone speakers.
 */
export async function requestAllPermissions(options: { mic?: boolean } = {}): Promise<PrimerReport> {
  const report: PrimerReport = {
    microphone: "unsupported",
    motion: "unsupported",
    geolocation: "unsupported",
    ready: false,
  };

  // --- Microphone: skip entirely unless the caller asks for it.
  if (options.mic && "mediaDevices" in navigator && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.getTracks().forEach((t) => t.stop());
      report.microphone = "granted";
    } catch (e) {
      report.microphone = nameToState(e);
    }
  }

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

  // "Ready" means we have what we actually need: motion+geo if
  // available, plus mic when the caller requested it.
  const motionOk = report.motion === "granted" || report.motion === "unsupported";
  const geoOk = report.geolocation === "granted" || report.geolocation === "unsupported";
  const micOk = !options.mic || report.microphone === "granted";
  report.ready = motionOk && geoOk && micOk;
  return report;
}

function nameToState(err: unknown): PermState {
  const name = (err as { name?: string } | undefined)?.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError") return "unsupported";
  return "prompt";
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
    // Consider the primer done as long as motion / location were
    // addressed. Mic is optional and handled separately.
    const motionOk = data.motion === "granted" || data.motion === "unsupported";
    const geoOk = data.geolocation === "granted" || data.geolocation === "unsupported";
    return Boolean(motionOk && geoOk);
  } catch {
    return false;
  }
}
