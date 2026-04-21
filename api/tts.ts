import { requireEnv, readJsonBody, sendError, pipeMp3, type ApiRequest, type ApiResponse } from "./_shared.js";

type Body = {
  text: string;
  voiceId: string;
  modelId?: string;
  style?: number;
  stability?: number;
  similarity?: number;
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
  if (!body?.text || !body?.voiceId) return sendError(res, 400, "text and voiceId required");

  const modelId = body.modelId ?? "eleven_turbo_v2_5";
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(body.voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: body.text,
        model_id: modelId,
        voice_settings: {
          stability: body.stability ?? 0.35,
          similarity_boost: body.similarity ?? 0.85,
          style: body.style ?? 0.7,
          use_speaker_boost: true,
        },
      }),
    }
  );
  await pipeMp3(res, upstream);
}
