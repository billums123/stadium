/**
 * Ambient crowd bed. If an ElevenLabs key is present, fetches a cached crowd SFX loop.
 * Otherwise, synthesises a filtered pink-noise loop via Web Audio for demo mode.
 *
 * Also exposes an optional generative music bed that can run alongside the
 * crowd loop for a third audio layer.
 */

import { generateSfx, generateMusic } from "./elevenlabs";

const CROWD_PROMPT =
  "A massive excited stadium crowd roaring, continuous ambient cheer, distant whistles and claps, no music, loopable";

const MUSIC_PROMPT =
  "Driving pump-up stadium anthem for a workout montage. Four-on-the-floor kick, heavy snare on 2 and 4, relentless synth bass pulse, gated reverb toms, rising filter sweeps that build into the chorus. Big triumphant brass stabs. No vocals, no chanting, no talking. Cinematic action-movie energy, 134 BPM, driving and forward, loopable so the end returns to the start cleanly.";

let cachedCrowdUrl: string | null = null;
let cachedMusicUrl: string | null = null;

export async function loadCrowdBed(): Promise<HTMLAudioElement> {
  if (!cachedCrowdUrl) {
    try {
      const blob = await generateSfx({ text: CROWD_PROMPT, durationSeconds: 12, promptInfluence: 0.7 });
      cachedCrowdUrl = URL.createObjectURL(blob);
    } catch {
      cachedCrowdUrl = null;
    }
  }
  const audio = new Audio();
  audio.loop = true;
  audio.volume = 0.22;
  audio.preload = "auto";
  if (cachedCrowdUrl) {
    audio.src = cachedCrowdUrl;
  } else {
    audio.src = synthesizeCrowdDataUrl();
  }
  return audio;
}

/**
 * Fetches (or reuses) a 30-second generative music bed. Intended to be
 * loaded in the background after the crowd bed is already playing, and
 * cross-faded in once ready. Returns null if the compose endpoint
 * fails — callers should treat music as optional garnish.
 */
export async function loadMusicBed(): Promise<HTMLAudioElement | null> {
  if (!cachedMusicUrl) {
    try {
      const blob = await generateMusic({ prompt: MUSIC_PROMPT, musicLengthMs: 30_000 });
      cachedMusicUrl = URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
  const audio = new Audio();
  audio.loop = true;
  audio.volume = 0;
  audio.preload = "auto";
  audio.src = cachedMusicUrl;
  return audio;
}

/**
 * Phase signal that shapes the music + crowd ceilings. Dash means
 * the athlete is in the last ~5% / 15 m stretch before a goal;
 * victory is the 3-second window after goal completion (horn has
 * just fired, music should peak). Anything else is `normal`.
 */
export type MusicPhase = "normal" | "dash" | "victory";

/**
 * Music-bed volume target given a goal-progress percentage (0..1),
 * a hype score (0..100), and the current phase. Dash raises the
 * ceiling. Victory pins the bed at peak for a few seconds to
 * punctuate the finish.
 */
export function musicVolumeFor(
  goalPct: number | null,
  hype: number,
  phase: MusicPhase = "normal"
): number {
  if (phase === "victory") return 0.55;
  const BASE = 0.14;
  const CEILING = phase === "dash" ? 0.48 : 0.34;

  const p = goalPct != null ? Math.max(0, Math.min(1, goalPct)) : 0;
  const progComponent = p < 0.6 ? p * 0.15 : 0.09 + (p - 0.6) * 0.5;
  const hypeComponent = Math.max(0, Math.min(1, hype / 100)) * 0.12;
  const picked = goalPct != null ? progComponent : hypeComponent;
  return Math.min(CEILING, BASE + picked);
}

/**
 * Crowd volume target, same phase-aware shape. Crowd leans louder
 * than music on dash/victory because a stadium roar at the finish
 * line is the expected sound.
 */
export function crowdVolumeFor(phase: MusicPhase = "normal"): number {
  if (phase === "victory") return 0.6;
  if (phase === "dash") return 0.45;
  return 0.22;
}

/**
 * Linear fade helper. Walks the audio element's volume to `target` over
 * `durationMs`; safe to call repeatedly (each call cancels the prior).
 */
export function fadeTo(audio: HTMLAudioElement, target: number, durationMs: number) {
  const start = audio.volume;
  const startAt = performance.now();
  const prev = (audio as HTMLAudioElement & { __fadeRaf?: number }).__fadeRaf;
  if (prev) cancelAnimationFrame(prev);
  const tick = () => {
    const t = Math.min(1, (performance.now() - startAt) / durationMs);
    audio.volume = start + (target - start) * t;
    if (t < 1) {
      (audio as HTMLAudioElement & { __fadeRaf?: number }).__fadeRaf = requestAnimationFrame(tick);
    }
  };
  tick();
}

/**
 * Very short procedural crowd: 2s filtered pink-noise WAV served as data URL.
 * Loops seamlessly. Used when no ElevenLabs key is provided.
 */
function synthesizeCrowdDataUrl(): string {
  const sampleRate = 22050;
  const duration = 2;
  const samples = sampleRate * duration;
  const buffer = new Float32Array(samples);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < samples; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    const envelope = 0.6 + 0.4 * Math.sin((i / samples) * Math.PI * 2);
    buffer[i] = pink * 0.08 * envelope;
  }

  return floatToWavDataUrl(buffer, sampleRate);
}

function floatToWavDataUrl(samples: Float32Array, sampleRate: number): string {
  const length = samples.length * 2 + 44;
  const ab = new ArrayBuffer(length);
  const view = new DataView(ab);
  writeString(view, 0, "RIFF");
  view.setUint32(4, length - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(ab);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return "data:audio/wav;base64," + btoa(binary);
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
}
