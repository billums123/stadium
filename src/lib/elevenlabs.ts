/**
 * Client for the server-side `/api/*` proxy — the browser never sees
 * the ElevenLabs key directly. The serverless functions in `/api/`
 * hold it in `process.env.ELEVENLABS_API_KEY` and forward the request
 * to the real ElevenLabs endpoints.
 */

export type TTSOpts = {
  text: string;
  voiceId: string;
  modelId?: string;
  style?: number;
  stability?: number;
  similarity?: number;
  signal?: AbortSignal;
};

export async function synthesizeSpeech(opts: TTSOpts): Promise<Blob> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: opts.text,
      voiceId: opts.voiceId,
      modelId: opts.modelId,
      style: opts.style,
      stability: opts.stability,
      similarity: opts.similarity,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`TTS failed: ${res.status} ${msg.slice(0, 180)}`);
  }
  return res.blob();
}

export type SFXOpts = {
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
  signal?: AbortSignal;
};

export async function generateSfx(opts: SFXOpts): Promise<Blob> {
  const res = await fetch("/api/sfx", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: opts.text,
      durationSeconds: opts.durationSeconds,
      promptInfluence: opts.promptInfluence,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`SFX failed: ${res.status} ${msg.slice(0, 180)}`);
  }
  return res.blob();
}

export type MusicOpts = {
  prompt: string;
  musicLengthMs?: number;
  signal?: AbortSignal;
};

export async function generateMusic(opts: MusicOpts): Promise<Blob> {
  const res = await fetch("/api/music", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      prompt: opts.prompt,
      musicLengthMs: opts.musicLengthMs,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Music failed: ${res.status} ${msg.slice(0, 180)}`);
  }
  return res.blob();
}

export type Voice = { voice_id: string; name: string; category?: string };

export async function listVoices(): Promise<Voice[]> {
  const res = await fetch("/api/voices");
  if (!res.ok) throw new Error(`Voices failed: ${res.status}`);
  const json = (await res.json()) as { voices: Voice[] };
  return json.voices ?? [];
}

/**
 * Lightweight server-health check. Returns true when both keys look
 * configured on the backend (indirectly — we hit /api/voices and take
 * a 200 as evidence the ElevenLabs key works).
 */
export type KeyStatus = "ok" | "missing" | "network-error";

export async function checkKey(): Promise<KeyStatus> {
  try {
    const res = await fetch("/api/voices");
    if (res.ok) return "ok";
    if (res.status === 500) return "missing";
    return "missing";
  } catch {
    return "network-error";
  }
}
