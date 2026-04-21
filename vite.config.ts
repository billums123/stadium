import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

/**
 * During `npm run dev`, serve the same `/api/*.ts` handlers that Vercel
 * will run in production. Handlers use Node's classic (req, res)
 * signature — we pre-read the JSON body for them since Vite's dev
 * middleware doesn't do that by default.
 */
function apiDevPlugin(): Plugin {
  const apiDir = path.resolve(process.cwd(), "api");
  return {
    name: "stadium-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/")) return next();

        const name = url.split("?")[0].replace(/^\/api\//, "").replace(/\/+$/, "");
        if (!/^[\w.-]+$/.test(name)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "bad api name" }));
          return;
        }

        const filePath = path.join(apiDir, `${name}.ts`);
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: `no handler /api/${name}` }));
          return;
        }

        // Pre-read the body so handlers can treat req.body as parsed JSON.
        if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          const raw = Buffer.concat(chunks).toString("utf-8");
          try {
            (req as unknown as { body?: unknown }).body = raw ? JSON.parse(raw) : {};
          } catch {
            (req as unknown as { body?: unknown }).body = raw;
          }
        }

        try {
          const mod = await server.ssrLoadModule(filePath);
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: (e as Error).message || String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevPlugin()],
  server: { host: true },
});
