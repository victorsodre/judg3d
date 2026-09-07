import { apiError } from "../api-errors.js";
import { lstat, readdir, realpath } from "node:fs/promises";
import { basename, join } from "node:path";

import {
  assertLayersImplemented,
  enabledLayers,
  loadProfile,
} from "@judg3d/core";
import type { Context } from "hono";

export type ProfileSummary = {
  id: string;
  version: string;
  filename: string;
  path: string;
  layers: import("@judg3d/core").LayerKind[];
};

export function createProfilesHandlers(profilesDir: string): {
  list: (c: Context) => Promise<Response>;
} {
  return {
    async list(c: Context): Promise<Response> {
      try {
        const entries = await readdir(profilesDir, { withFileTypes: true });
        const summaries: ProfileSummary[] = [];

        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith(".json")) {
            continue;
          }
          const path = join(profilesDir, entry.name);
          const { profile } = await loadProfile(
            await resolveProfileFile(profilesDir, entry.name),
          );
          assertLayersImplemented(profile);
          summaries.push({
            id: profile.id,
            version: profile.version,
            filename: basename(path),
            path: basename(path),
            layers: enabledLayers(profile),
          });
        }

        summaries.sort((a, b) => a.id.localeCompare(b.id));
        return c.json({ profiles: summaries });
      } catch {
        return c.json(apiError("PROFILES_UNAVAILABLE", "infra"), 500);
      }
    },
  };
}

export async function resolveProfileFile(
  profilesDir: string,
  name: string,
): Promise<string> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(name) || name.includes("..")) {
    throw new Error("Invalid profile name.");
  }
  const root = await realpath(profilesDir);
  const path = join(root, name);
  if (!(await lstat(path)).isFile() || (await realpath(path)) !== path) {
    throw new Error("Invalid profile.");
  }
  return path;
}
