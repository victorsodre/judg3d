import type { Context } from "hono";

import { APP_VERSION } from "../version.js";

export function healthHandler(c: Context): Response {
  return c.json({
    ok: true,
    name: "judg3d-app",
    version: APP_VERSION,
  });
}
