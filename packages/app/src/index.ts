import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import {
  resolveClientDist,
  resolveProfilesDir,
  resolveRepoRoot,
} from "./paths.js";
import { APP_VERSION } from "./version.js";

const port = Number(process.env["JUDG3D_APP_PORT"] ?? "8787");
const repoRoot = resolveRepoRoot();
const profilesDir = resolveProfilesDir(repoRoot);
const clientDist = resolveClientDist();
const serveClient = process.env["JUDG3D_APP_SERVE_CLIENT"] !== "0";

const app = createApp({
  profilesDir,
  serveClient,
  clientDist,
});

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  process.stdout.write(
    `judg3d app ${APP_VERSION} · http://127.0.0.1:${String(info.port)}\n`,
  );
  process.stdout.write(`profiles · ${profilesDir}\n`);
  if (serveClient) {
    process.stdout.write(`ui      · ${clientDist}\n`);
  }
});
