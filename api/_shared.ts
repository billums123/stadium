/**
 * Shared helpers for the serverless API functions.
 *
 * Functions live in `/api/*.ts` and run as Vercel Node serverless
 * functions in production. Locally they're mounted by the Vite dev
 * plugin in `vite.config.ts` using the same signature.
 *
 * `dotenv/config` is a no-op on Vercel (its env vars are already in
 * process.env) but makes local `.env` files work in the dev plugin
 * without requiring `--env-file=.env` or a shell export.
 */

import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";

export type ApiRequest = IncomingMessage & { body?: unknown };
export type ApiResponse = ServerResponse;

export function requireEnv(name: string): string {
  // Accept either the bare name (preferred) or the VITE_-prefixed variant
  // so an existing local .env from the pre-proxy era keeps working in dev.
  const v = process.env[name] ?? process.env[`VITE_${name}`];
  if (!v || !v.trim()) {
    throw new Error(`Server env var ${name} is missing`);
  }
  return v.trim();
}

export function readJsonBody<T = Record<string, unknown>>(req: ApiRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    // Vite dev plugin may have pre-parsed the body.
    if (req.body && typeof req.body === "object") {
      resolve(req.body as T);
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      try {
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function sendJson(res: ApiResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function sendError(res: ApiResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

export async function pipeMp3(res: ApiResponse, upstream: Response): Promise<void> {
  if (!upstream.ok) {
    const body = await upstream.text().catch(() => "");
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json");
    res.end(body || JSON.stringify({ error: `upstream ${upstream.status}` }));
    return;
  }
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", String(buf.length));
  res.setHeader("Cache-Control", "no-store");
  res.end(buf);
}
