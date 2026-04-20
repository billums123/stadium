/**
 * Pace & motion tracker. Uses Geolocation for real distance/speed when available.
 * Falls back to DeviceMotion accelerometer or a simulated jog timer for desktop demo.
 */

export type MotionState = {
  distanceMeters: number;
  elapsedMs: number;
  paceKmh: number; // instantaneous speed (m/s -> km/h)
  steps: number;
  movementIntensity: number; // 0-1 rolling, from accel magnitude
  lat: number | null;
  lon: number | null;
  sourceGeo: boolean;
  sourceMotion: boolean;
};

export type MotionTracker = {
  state: MotionState;
  start: () => Promise<void>;
  stop: () => void;
  simulate: (kmh: number) => void;
};

const START: MotionState = {
  distanceMeters: 0,
  elapsedMs: 0,
  paceKmh: 0,
  steps: 0,
  movementIntensity: 0,
  lat: null,
  lon: null,
  sourceGeo: false,
  sourceMotion: false,
};

function haversineMeters(a: GeolocationCoordinates, b: GeolocationCoordinates) {
  const R = 6371000;
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const dφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function createMotionTracker(onUpdate: (s: MotionState) => void): MotionTracker {
  const state: MotionState = { ...START };
  let geoWatchId: number | null = null;
  let motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  let tickInterval: number | null = null;
  let startTs = 0;
  let lastFix: GeolocationPosition | null = null;
  let simKmh = 0;
  let simTick: number | null = null;

  let accelEma = 0;
  let stepCooldownUntil = 0;

  function emit() {
    onUpdate({ ...state });
  }

  async function start() {
    Object.assign(state, START);
    startTs = performance.now();

    if ("geolocation" in navigator) {
      try {
        geoWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            state.lat = pos.coords.latitude;
            state.lon = pos.coords.longitude;
            state.sourceGeo = true;
            if (lastFix) {
              const d = haversineMeters(lastFix.coords, pos.coords);
              if (d > 1 && d < 200) state.distanceMeters += d;
            }
            if (pos.coords.speed != null && pos.coords.speed >= 0) {
              state.paceKmh = pos.coords.speed * 3.6;
            }
            lastFix = pos;
            emit();
          },
          () => { /* ignore; fallbacks still work */ },
          { enableHighAccuracy: true, maximumAge: 1500, timeout: 8000 }
        );
      } catch { /* noop */ }
    }

    if ("DeviceMotionEvent" in window) {
      const needsPermission =
        typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
          .requestPermission === "function";
      try {
        if (needsPermission) {
          const ask = (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> })
            .requestPermission;
          const perm = await ask();
          if (perm !== "granted") throw new Error("motion denied");
        }
        motionHandler = (e: DeviceMotionEvent) => {
          const acc = e.accelerationIncludingGravity || e.acceleration;
          if (!acc) return;
          const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
          const deviation = Math.abs(mag - 9.81);
          accelEma = accelEma * 0.85 + deviation * 0.15;
          state.movementIntensity = Math.min(1, accelEma / 8);
          state.sourceMotion = true;
          const now = performance.now();
          if (deviation > 6 && now > stepCooldownUntil) {
            state.steps += 1;
            stepCooldownUntil = now + 300;
          }
        };
        window.addEventListener("devicemotion", motionHandler);
      } catch { /* skip */ }
    }

    tickInterval = window.setInterval(() => {
      state.elapsedMs = performance.now() - startTs;
      if (state.sourceMotion && !state.sourceGeo) {
        const kmh = state.movementIntensity * 15;
        state.paceKmh = state.paceKmh * 0.8 + kmh * 0.2;
        state.distanceMeters += (state.paceKmh / 3.6) * 0.25;
      }
      emit();
    }, 250);
  }

  function stop() {
    if (geoWatchId != null) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
    if (motionHandler) {
      window.removeEventListener("devicemotion", motionHandler);
      motionHandler = null;
    }
    if (tickInterval != null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    if (simTick != null) {
      clearInterval(simTick);
      simTick = null;
    }
  }

  function simulate(kmh: number) {
    simKmh = kmh;
    if (simTick == null) {
      startTs = performance.now();
      Object.assign(state, START);
      simTick = window.setInterval(() => {
        state.paceKmh = state.paceKmh * 0.85 + simKmh * 0.15;
        state.elapsedMs = performance.now() - startTs;
        state.distanceMeters += (state.paceKmh / 3.6) * 0.25;
        state.movementIntensity = Math.min(1, simKmh / 18);
        state.steps += simKmh > 4 ? 1 : 0;
        emit();
      }, 250);
    }
  }

  return { state, start, stop, simulate };
}
