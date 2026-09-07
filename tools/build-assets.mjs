import { cp, mkdir, readdir, rm } from "node:fs/promises";

for (const directory of ["core", "judge", "mcp", "app", "cli"]) {
  for (const filename of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
    await cp(
      new URL(`../${filename}`, import.meta.url),
      new URL(`../packages/${directory}/${filename}`, import.meta.url),
    );
  }
}

const source = new URL("../profiles/", import.meta.url);
const target = new URL("../packages/app/bundled-profiles/", import.meta.url);
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".json")) {
    await cp(new URL(entry.name, source), new URL(entry.name, target));
  }
}
