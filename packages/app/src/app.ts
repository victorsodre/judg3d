import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";

import { resolveClientDist } from "./paths.js";
import { healthHandler } from "./routes/health.js";
import { createJudgeHandler } from "./routes/judge.js";
import { createProfilesHandlers } from "./routes/profiles.js";

export type CreateAppOptions = {
  profilesDir: string;
  /** Quando true, serve a UI buildada de client-dist/. */
  serveClient?: boolean;
  clientDist?: string;
  maxUploadBytes?: number;
  maxConcurrentJobs?: number;
  jobTimeoutMs?: number;
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
  const maxUploadBytes = options.maxUploadBytes ?? 64 * 1024 * 1024;
  const maxConcurrentJobs = options.maxConcurrentJobs ?? 2;
  let activeJobs = 0;
  const developmentOrigins = ["http://127.0.0.1:5173", "http://localhost:5173"];

  app.use("*", async (c, next) => {
    const requestUrl = new URL(c.req.url);
    const origin = c.req.header("Origin");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname) ||
      (origin !== undefined && origin !== requestUrl.origin && !developmentOrigins.includes(origin))) {
      return c.json({ ok: false, exitHint: 2, error: "bad_request", message: "Origem não permitida." }, 403);
    }
    await next();
  });

  app.use(
    "/api/*",
    cors({
      origin: developmentOrigins,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  app.get("/api/health", healthHandler);
  app.get("/api/profiles", (c) => profiles.list(c));
  app.use("/api/judge", async (c, next) => {
    if (c.req.method !== "POST") { await next(); return; }
    if (activeJobs >= maxConcurrentJobs) {
      return c.json({ ok: false, exitHint: 2, error: "bad_request", message: "Já há arquivos em processamento. Tente novamente em instantes." }, 429);
    }
    activeJobs += 1;
    try { await next(); } finally { activeJobs -= 1; }
  });
  app.use("/api/judge", bodyLimit({
    maxSize: maxUploadBytes,
    onError: (c) => c.json({ ok: false, exitHint: 2, error: "bad_request", message: "O upload excede o limite permitido." }, 413),
  }));
  app.post("/api/judge", createJudgeHandler(options.profilesDir, options.jobTimeoutMs ?? 30_000));

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
