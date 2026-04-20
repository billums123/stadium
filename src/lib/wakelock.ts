/**
 * Screen wake lock wrapper. The broadcast is useless if the phone dims
 * mid-run and the browser throttles audio playback, so we hold the
 * screen awake for the duration of a session.
 *
 * Browsers auto-release the lock on tab hide; we re-acquire on visibility
 * change while still "on".
 */

type WL = { release: () => Promise<void> };

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WL> };
};

export type WakeLockHandle = {
  release: () => Promise<void>;
};

export async function acquireWakeLock(): Promise<WakeLockHandle | null> {
  const nav = navigator as NavigatorWithWakeLock;
  if (!nav.wakeLock?.request) return null;

  let current: WL | null = null;
  let disposed = false;

  const take = async () => {
    if (disposed || document.visibilityState !== "visible") return;
    try {
      current = await nav.wakeLock!.request("screen");
    } catch {
      /* denied or unavailable */
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") void take();
  };

  document.addEventListener("visibilitychange", onVisibility);
  await take();
  if (!current) {
    document.removeEventListener("visibilitychange", onVisibility);
    return null;
  }

  return {
    release: async () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try { await current?.release(); } catch { /* noop */ }
      current = null;
    },
  };
}
