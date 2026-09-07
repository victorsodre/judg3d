import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { parseProfile } from "@judg3d/core";
import type { Context } from "hono";

export type ProfileSummary = {
  id: string;
  version: string;
  filename: string;
  path: string;
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
          const raw = await readFile(path, "utf8");
          const profile = parseProfile(raw, path);
          summaries.push({
            id: profile.id,
            version: profile.version,
            filename: basename(path),
            path: basename(path),
          });
        }

        summaries.sort((a, b) => a.id.localeCompare(b.id));
        return c.json({ profiles: summaries });
      } catch {
        return c.json(
          {
            error: "infra",
            message: "Nao consegui listar os profiles.",
          },
          500,
        );
      }
    },
  };
}
