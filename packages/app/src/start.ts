import { access } from "node:fs/promises";
import { join } from "node:path";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { InfraError } from "@judg3d/core";
import { createApp } from "./app.js";
import { resolveClientDist, resolveProfilesDir } from "./paths.js";
import { APP_VERSION } from "./version.js";

export { resolveProfilesDir } from "./paths.js";

export async function startApp({
  port = 8787,
  profilesDir = resolveProfilesDir(),
  development = false,
}: {
  port?: number;
  profilesDir?: string;
  development?: boolean;
} = {}): Promise<ServerType> {
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new InfraError("Invalid port: use an integer between 0 and 65535.");
  const clientDist = resolveClientDist();
  await access(profilesDir);
  if (!development) await access(join(clientDist, "index.html"));
  const app = createApp({
    profilesDir,
    serveClient: !development,
    clientDist,
    development,
  });
  return new Promise((resolve, reject) => {
    const server = serve(
      {
        fetch: app.fetch,
        port,
        hostname: "127.0.0.1",
        serverOptions: {
          requestTimeout: 30_000,
          headersTimeout: 10_000,
          connectionsCheckingInterval: 1_000,
        },
      },
      (info) => {
        process.stdout.write(
          `judg3d ${APP_VERSION} · http://127.0.0.1:${info.port}\n`,
        );
        resolve(server);
      },
    );
    server.once("error", reject);
  });
}
