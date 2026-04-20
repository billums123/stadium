/**
 * Minimal browser-side ElevenLabs client.
 * Uses the user's API key (stored in localStorage) and calls the REST API directly.
 * Voices: https://api.elevenlabs.io/v1/voices
 * TTS:    https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 * SFX:    https://api.elevenlabs.io/v1/sound-generation
 */

const BASE = "https://api.elevenlabs.io/v1";

export type TTSOpts = {
  text: string;
  voiceId: string;
  apiKey: string;
  modelId?: string;
  style?: number;
  stability?: number;
  similarity?: number;
  signal?: AbortSignal;
};

export async function synthesizeSpeech(opts: TTSOpts): Promise<Blob> {
  const {
    text,
    voiceId,
    apiKey,
    modelId = "eleven_turbo_v2_5",
    style = 0.7,
    stability = 0.35,
    similarity = 0.85,
    signal,
  } = opts;

  const res = await fetch(`${BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability,
        similarity_boost: similarity,
        style,
        use_speaker_boost: true,
      },
    }),
    signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${msg.slice(0, 160)}`);
  }
  return res.blob();
}

export type SFXOpts = {
  text: string;
  apiKey: string;
  durationSeconds?: number; // 0.5 - 22
  promptInfluence?: number; // 0-1
  signal?: AbortSignal;
};

export async function generateSfx(opts: SFXOpts): Promise<Blob> {
  const { text, apiKey, durationSeconds, promptInfluence = 0.6, signal } = opts;

  const body: Record<string, unknown> = {
    text,
    prompt_influence: promptInfluence,
  };
  if (durationSeconds != null) body.duration_seconds = durationSeconds;

  const res = await fetch(`${BASE}/sound-generation`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`ElevenLabs SFX failed: ${res.status} ${msg.slice(0, 160)}`);
  }
  return res.blob();
}

export type Voice = { voice_id: string; name: string; category?: string };

export type MusicOpts = {
  apiKey: string;
  prompt: string;
  musicLengthMs?: number; // 3000 - 600000
  signal?: AbortSignal;
};

export async function generateMusic(opts: MusicOpts): Promise<Blob> {
  const { apiKey, prompt, musicLengthMs = 30000, signal } = opts;

  const res = await fetch(`${BASE}/music?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: Math.max(3000, Math.min(600000, Math.round(musicLengthMs))),
    }),
    signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Music compose failed: ${res.status} ${msg.slice(0, 180)}`);
  }
  return res.blob();
}

export async function listVoices(apiKey: string): Promise<Voice[]> {
  const res = await fetch(`${BASE}/voices`, { headers: { "xi-api-key": apiKey } });
  if (!res.ok) throw new Error(`Voices failed: ${res.status}`);
  const json = (await res.json()) as { voices: Voice[] };
  return json.voices ?? [];
}

export async function verifyKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/user`, { headers: { "xi-api-key": apiKey } });
    return res.ok;
  } catch {
    return false;
  }
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
