/**
 * Thin client for the /api/llm proxy. The browser never sees the
 * OpenAI key — `process.env.OPENAI_API_KEY` on the server-side
 * function handles it. Never throws; returns null on any failure so
 * commentary always degrades gracefully to the template engine.
 */

export const MODEL_OPTIONS: Array<{ id: string; label: string; note: string }> = [
  { id: "gpt-5.4-nano", label: "GPT-5.4 Nano", note: "cheapest, fastest, a touch flatter" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", note: "recommended — sharp + cheap" },
  { id: "gpt-5.4", label: "GPT-5.4", note: "more polish, slower" },
];

export const DEFAULT_MODEL = "gpt-5.4-mini";

export type GenerateOpts = {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
};

export async function generateLine(opts: GenerateOpts): Promise<string | null> {
  const {
    system,
    user,
    model = DEFAULT_MODEL,
    maxTokens = 180,
    temperature = 0.95,
    timeoutMs = 4000,
    abortSignal,
  } = opts;

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort("llm-timeout"), timeoutMs);
  if (abortSignal) abortSignal.addEventListener("abort", () => controller.abort("caller-abort"));

  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ system, user, model, maxTokens, temperature }),
    });
    if (!res.ok) return null;
    const { text } = (await res.json()) as { text: string | null };
    if (!text) return null;
    return stripArtefacts(text);
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

/**
 * Fire-and-forget priming request — opens the TLS path to the proxy
 * (and through to OpenAI) so the first live commentary line doesn't
 * eat the cold-start penalty.
 */
export function warmUp(model = DEFAULT_MODEL): void {
  void generateLine({
    system: "Terse health check. Output exactly: OK",
    user: "ping",
    model,
    maxTokens: 4,
    timeoutMs: 5000,
  });
}

function stripArtefacts(text: string): string {
  let t = text.trim();
  t = t.replace(/^["'`]|["'`]$/g, "");
  t = t.replace(/^(here'?s?\s+(the|a|one|your)\s+line:?\s*)/i, "");
  t = t.replace(/^(line:|commentary:|output:)\s*/i, "");
  t = t.replace(/\n+/g, " ");
  return t.trim();
}
