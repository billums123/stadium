import { requireEnv, readJsonBody, sendError, pipeMp3, type ApiRequest, type ApiResponse } from "./_shared.js";

type Body = {
  prompt: string;
  musicLengthMs?: number;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return sendError(res, 405, "POST only");

  let key: string;
  try {
    key = requireEnv("ELEVENLABS_API_KEY");
  } catch (e) {
    return sendError(res, 500, (e as Error).message);
  }

  const body = await readJsonBody<Body>(req);
  if (!body?.prompt) return sendError(res, 400, "prompt required");

  const lengthMs = Math.max(3000, Math.min(600_000, Math.round(body.musicLengthMs ?? 30_000)));

  const upstream = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      prompt: body.prompt,
      music_length_ms: lengthMs,
    }),
  });
  await pipeMp3(res, upstream);
}
