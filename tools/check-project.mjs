import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const names = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
];
for (const name of [
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "GOVERNANCE.md",
  "SUPPORT.md",
  "ROADMAP.md",
  "CHANGELOG.md",
  "THIRD_PARTY_NOTICES.md",
  ".github/CODEOWNERS",
]) {
  await access(resolve(root, name));
}
let links = 0;
for (const name of names.filter((name) => name.endsWith(".md"))) {
  let contents;
  try {
    contents = await readFile(resolve(root, name), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  const prose = contents.replace(/```[\s\S]*?```/g, "");
  for (const match of prose.matchAll(
    /\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g,
  )) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    assert(!target.startsWith("/"), `${name}: use portable relative links`);
    await access(resolve(root, dirname(name), decodeURIComponent(target)));
    links++;
  }
}
for (const directory of ["core", "judge", "app", "mcp", "cli"]) {
  const p = JSON.parse(
    await readFile(resolve(root, `packages/${directory}/package.json`), "utf8"),
  );
  assert.equal(p.license, "MIT");
  assert.equal(p.repository.directory, `packages/${directory}`);
  assert(
    p.files.includes("LICENSE") && p.files.includes("THIRD_PARTY_NOTICES.md"),
  );
}
const notices = await readFile(resolve(root, "THIRD_PARTY_NOTICES.md"), "utf8");
const reactDomManifest = await realpath(
  resolve(root, "packages/app/node_modules/react-dom/package.json"),
);
const bundledRequire = createRequire(reactDomManifest);
for (const path of [
  resolve(root, "packages/app/node_modules/react/package.json"),
  reactDomManifest,
  bundledRequire.resolve("scheduler/package.json"),
]) {
  const dependency = JSON.parse(await readFile(path, "utf8"));
  const license = await readFile(resolve(dirname(path), "LICENSE"), "utf8");
  assert(
    notices.includes(dependency.version),
    `${dependency.name}: update the bundled version notice`,
  );
  assert(
    notices.replace(/\s+/g, " ").includes(license.trim().replace(/\s+/g, " ")),
    `${dependency.name}: preserve the upstream license`,
  );
}
const application = JSON.parse(
  await readFile(
    resolve(root, "docs/maintainers/application-draft.json"),
    "utf8",
  ),
);
for (const field of [
  "whyRepositoryQualifies",
  "apiCreditUse",
  "additionalContext",
]) {
  assert.equal(typeof application[field], "string");
  assert(
    application[field].length > 0 && application[field].length <= 500,
    `${field}: must contain 1–500 characters`,
  );
}
process.stdout.write(
  `Project docs verified: ${links} local links, community files, package metadata and application character limits.\n`,
);
