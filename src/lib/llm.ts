/**
 * OpenAI Chat Completions client, browser-side.
 *
 * - Direct browser calls with `Authorization: Bearer <key>`. Same
 *   trade-off as the ElevenLabs key (static bundle ship, throwaway
 *   demo scope; upgrade path is a serverless proxy).
 * - Default model `gpt-5.4-mini`: sharp character voice at low cost
 *   and sub-second TTFT. Tunable in Settings for those who want to
 *   push to `gpt-5.4` (more polish) or `gpt-5.4-nano` (cheaper still).
 * - 2.5 s hard timeout. Callers must fall back to templates when
 *   `generateLine()` returns null — the broadcast must never stall.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export const MODEL_OPTIONS: Array<{ id: string; label: string; note: string }> = [
  { id: "gpt-5.4-nano",  label: "GPT-5.4 Nano",  note: "cheapest, fastest, a touch flatter" },
  { id: "gpt-5.4-mini",  label: "GPT-5.4 Mini",  note: "recommended — sharp + cheap" },
  { id: "gpt-5.4",       label: "GPT-5.4",       note: "more polish, slower" },
];

export const DEFAULT_MODEL = "gpt-5.4-mini";

const ENV_KEY =
  (import.meta.env?.VITE_OPENAI_API_KEY as string | undefined)?.trim() || "";

export function loadOpenAIEnvKey(): string {
  return ENV_KEY;
}

export type GenerateOpts = {
  apiKey: string;
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
};

/**
 * Returns the generated text, or null if the call fails / times out.
 * Never throws — commentary must degrade gracefully to templates.
 */
export async function generateLine(opts: GenerateOpts): Promise<string | null> {
  const {
    apiKey,
    system,
    user,
    model = DEFAULT_MODEL,
    maxTokens = 160,
    temperature = 0.95,
    timeoutMs = 4000,
    abortSignal,
  } = opts;

  if (!apiKey) return null;

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort("llm-timeout"), timeoutMs);
  if (abortSignal) {
    abortSignal.addEventListener("abort", () => controller.abort("caller-abort"));
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_completion_tokens: maxTokens,
        temperature,
        presence_penalty: 0.35,
        frequency_penalty: 0.45,
      }),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? null;
    if (!text) return null;
    return stripArtefacts(text);
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

/**
 * Fire-and-forget priming request. Opens the TLS connection and warms
 * OpenAI's routing so the first real commentary line doesn't eat the
 * cold-start penalty (~2.8s vs ~1s once warm).
 */
export function warmUp(apiKey: string, model = DEFAULT_MODEL): void {
  if (!apiKey) return;
  void generateLine({
    apiKey,
    system: "You are a terse health check. Output exactly: OK",
    user: "ping",
    model,
    maxTokens: 4,
    timeoutMs: 5000,
  });
}

/**
 * Strip quotes, markdown noise, or meta like "Here's the line:" that
 * models occasionally produce despite instruction. Keep bracketed audio
 * tags intact — those are deliberate delivery cues.
 */
function stripArtefacts(text: string): string {
  let t = text.trim();
  t = t.replace(/^["'`]|["'`]$/g, "");
  t = t.replace(/^(here'?s?\s+(the|a|one|your)\s+line:?\s*)/i, "");
  t = t.replace(/^(line:|commentary:|output:)\s*/i, "");
  t = t.replace(/\n+/g, " ");
  return t.trim();
}
