import { requireEnv, readJsonBody, sendError, sendJson, type ApiRequest, type ApiResponse } from "./_shared.js";

type Body = {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return sendError(res, 405, "POST only");

  let key: string;
  try {
    key = requireEnv("OPENAI_API_KEY");
  } catch (e) {
    return sendError(res, 500, (e as Error).message);
  }

  const body = await readJsonBody<Body>(req);
  if (!body?.system || !body?.user) return sendError(res, 400, "system and user required");

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model ?? "gpt-5.4-mini",
      messages: [
        { role: "system", content: body.system },
        { role: "user", content: body.user },
      ],
      max_completion_tokens: body.maxTokens ?? 180,
      temperature: body.temperature ?? 0.95,
      presence_penalty: 0.35,
      frequency_penalty: 0.45,
    }),
  });

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    return sendJson(res, upstream.status, { error: txt || "upstream failed" });
  }

  const json = await upstream.json();
  const text = json?.choices?.[0]?.message?.content?.trim() ?? null;
  sendJson(res, 200, { text });
}
