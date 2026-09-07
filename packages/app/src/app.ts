import { apiError } from "./api-errors.js";
import { existsSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { MAX_ASSET_BYTES } from "@judg3d/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";

import { resolveClientDist } from "./paths.js";
import { healthHandler } from "./routes/health.js";
import { createJudgeHandler } from "./routes/judge.js";
import { createProfilesHandlers } from "./routes/profiles.js";

export type CreateAppOptions = {
  profilesDir: string;
  /** Serve the compiled local client. */
  serveClient?: boolean;
  clientDist?: string;
  maxUploadBytes?: number;
  maxConcurrentJobs?: number;
  jobTimeoutMs?: number;
  development?: boolean;
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
  const maxUploadBytes = options.maxUploadBytes ?? MAX_ASSET_BYTES + 64 * 1024;
  const maxConcurrentJobs = options.maxConcurrentJobs ?? 2;
  let activeJobs = 0;
  const developmentOrigins =
    options.development === true
      ? ["http://127.0.0.1:5173", "http://localhost:5173"]
      : [];

  app.use("*", async (c, next) => {
    const requestUrl = new URL(c.req.url);
    const origin = c.req.header("Origin");
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname) ||
      (origin !== undefined &&
        origin !== requestUrl.origin &&
        !developmentOrigins.includes(origin))
    ) {
      return c.json(apiError("ORIGIN_REJECTED"), 403);
    }
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Cache-Control", "no-store");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
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
    if (c.req.method !== "POST") {
      await next();
      return;
    }
    if (activeJobs >= maxConcurrentJobs) {
      return c.json(apiError("BUSY"), 429);
    }
    activeJobs += 1;
    try {
      await next();
    } finally {
      activeJobs -= 1;
    }
  });
  app.use(
    "/api/judge",
    bodyLimit({
      maxSize: maxUploadBytes,
      onError: (c) => c.json(apiError("UPLOAD_TOO_LARGE"), 413),
    }),
  );
  app.post(
    "/api/judge",
    createJudgeHandler(options.profilesDir, options.jobTimeoutMs ?? 30_000),
  );

  app.all("/api/*", (c) => c.json(apiError("ROUTE_NOT_FOUND"), 404));

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
        "The UI has not been built. Run: pnpm --filter @judg3d/app build:ui",
        404,
      ),
    );
    return;
  }

  app.get("/*", async (c) => {
    try {
      const path = decodeURIComponent(c.req.path);
      if (
        path.includes("\\") ||
        path.includes("\0") ||
        path.split("/").some((part) => part.startsWith("."))
      ) {
        return c.text("Not found", 404);
      }
      const root = await realpath(clientRoot);
      // The UI has one route; missing static assets must not receive an HTML 200 response.
      const filePath = await realpath(
        join(root, path === "/" ? "index.html" : path),
      );
      const rel = relative(root, filePath);
      if (
        rel === ".." ||
        rel.startsWith(`..${sep}`) ||
        isAbsolute(rel) ||
        !(await stat(filePath)).isFile()
      ) {
        return c.text("Not found", 404);
      }
      return c.body(await readFile(filePath), 200, {
        "Content-Type":
          CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      });
    } catch {
      return c.text("Not found", 404);
    }
  });
}
