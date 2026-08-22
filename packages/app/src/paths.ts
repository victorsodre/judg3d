import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve caminhos do monorepo sem acoplar a UI ao layout interno.
 * Em testes, `JUDG3D_REPO_ROOT` aponta pro fixture isolado.
 */
export function resolveRepoRoot(
  fromUrl: string = import.meta.url,
): string {
  const override = process.env["JUDG3D_REPO_ROOT"];
  if (override !== undefined && override !== "") {
    return resolve(override);
  }

  let dir = dirname(fileURLToPath(fromUrl));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new Error(
    "Nao encontrei a raiz do monorepo (pnpm-workspace.yaml). Defina JUDG3D_REPO_ROOT.",
  );
}

export function resolveProfilesDir(repoRoot: string): string {
  const override = process.env["JUDG3D_PROFILES_DIR"];
  if (override !== undefined && override !== "") {
    return resolve(override);
  }
  return join(repoRoot, "profiles");
}

export function resolveClientDist(fromUrl: string = import.meta.url): string {
  return join(dirname(fileURLToPath(fromUrl)), "..", "client-dist");
}
