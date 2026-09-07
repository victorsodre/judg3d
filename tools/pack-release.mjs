import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "artifacts/release");
await mkdir(output, { recursive: true });
const packages = [];
for (const directory of ["core", "judge", "mcp", "app", "cli"]) {
  const cwd = join(root, "packages", directory);
  const manifest = JSON.parse(
    await readFile(join(cwd, "package.json"), "utf8"),
  );
  const { stdout, stderr } = await exec(
    "pnpm",
    ["pack", "--pack-destination", output],
    { cwd, timeout: 60_000 },
  );
  await writeFile(join(output, `${directory}-pack.log`), stdout + stderr);
  const filename = `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`;
  const bytes = await readFile(join(output, filename));
  packages.push({
    name: manifest.name,
    version: manifest.version,
    filename,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await writeFile(
  join(output, "manifest.json"),
  JSON.stringify({ packages }, null, 2) + "\n",
);
process.stdout.write(
  `Prepared ${packages.length} packages in ${output}. Nothing was published.\n`,
);
