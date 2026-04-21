import { requireEnv, sendError, sendJson, type ApiRequest, type ApiResponse } from "./_shared.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return sendError(res, 405, "GET only");

  let key: string;
  try {
    key = requireEnv("ELEVENLABS_API_KEY");
  } catch (e) {
    return sendError(res, 500, (e as Error).message);
  }

  const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    return sendJson(res, upstream.status, { error: txt || "upstream failed" });
  }

  const json = await upstream.json();
  // Trim the response to just what the client needs so we don't leak
  // any account-level fields through a proxy.
  const voices = (json.voices || []).map((v: { voice_id: string; name: string; category?: string }) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
  }));
  sendJson(res, 200, { voices });
}
