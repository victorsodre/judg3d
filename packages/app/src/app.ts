import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";

import { Hono } from "hono";
import { cors } from "hono/cors";

import { resolveClientDist } from "./paths.js";
import { healthHandler } from "./routes/health.js";
import { createJudgeHandler } from "./routes/judge.js";
import { createProfilesHandlers } from "./routes/profiles.js";

export type CreateAppOptions = {
  profilesDir: string;
  /** Quando true, serve a UI buildada de client-dist/. */
  serveClient?: boolean;
  clientDist?: string;
};

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export function createApp(options: CreateAppOptions): Hono {
  const app = new Hono();
  const profiles = createProfilesHandlers(options.profilesDir);

  app.use(
    "/api/*",
    cors({
      origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/api/health", healthHandler);
  app.get("/api/profiles", (c) => profiles.list(c));
  app.post("/api/judge", createJudgeHandler(options.profilesDir));

  if (options.serveClient === true) {
    const clientRoot = resolve(options.clientDist ?? resolveClientDist());
    mountClient(app, clientRoot);
  }

  return app;
}

function mountClient(app: Hono, clientRoot: string): void {
  if (!existsSync(clientRoot)) {
    app.get("/*", (c) =>
      c.text(
        "UI ainda nao foi buildada. Rode: pnpm --filter @judg3d/app build:ui",
        404,
      ),
    );
    return;
  }

  app.get("/*", async (c) => {
    const urlPath = c.req.path === "/" ? "/index.html" : c.req.path;
    const candidate = normalize(join(clientRoot, urlPath));
    const rel = relative(clientRoot, candidate);
    if (rel.startsWith("..")) {
      return c.text("Not found", 404);
    }

    const filePath = existsSync(candidate)
      ? candidate
      : join(clientRoot, "index.html");

    try {
      const bytes = await readFile(filePath);
      const type =
        CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
      return c.body(bytes, 200, { "Content-Type": type });
    } catch {
      return c.text("Not found", 404);
    }
  });
}
