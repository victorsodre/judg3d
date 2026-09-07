import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveProfilesDir(): string {
  const override = process.env["JUDG3D_PROFILES_DIR"];
  return override
    ? resolve(override)
    : fileURLToPath(new URL("../bundled-profiles/", import.meta.url));
}

export function resolveClientDist(): string {
  return fileURLToPath(new URL("../client-dist/", import.meta.url));
}
