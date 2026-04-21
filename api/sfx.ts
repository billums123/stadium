import { requireEnv, readJsonBody, sendError, pipeMp3, type ApiRequest, type ApiResponse } from "./_shared.js";

type Body = {
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
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
  if (!body?.text) return sendError(res, 400, "text required");

  const payload: Record<string, unknown> = {
    text: body.text,
    prompt_influence: body.promptInfluence ?? 0.6,
  };
  if (body.durationSeconds != null) payload.duration_seconds = body.durationSeconds;

  const upstream = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(payload),
  });
  await pipeMp3(res, upstream);
}
