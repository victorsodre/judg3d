import { rm } from "node:fs/promises";

for (const name of ["core", "judge", "mcp", "app", "cli"]) {
  for (const path of ["dist", "tsconfig.tsbuildinfo"]) {
    await rm(new URL(`../packages/${name}/${path}`, import.meta.url), {
      recursive: true,
      force: true,
    });
  }
}
