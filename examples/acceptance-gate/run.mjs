import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(root, "artifacts/demo");
const cli = join(root, "packages/cli/dist/index.js");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
await mkdir(output, { recursive: true });

async function run(args, expected) {
  let stdout;
  let code = 0;
  try {
    ({ stdout } = await exec(process.execPath, [cli, ...args], {
      cwd: root,
      timeout: 35_000,
      maxBuffer: 2 * 1024 * 1024,
    }));
  } catch (error) {
    if (typeof error.code !== "number") throw error;
    ({ stdout, code } = error);
  }
  assert.equal(code, expected, `Unexpected exit for ${args.join(" ")}`);
  return stdout;
}

const cases = [];
for (const [id, asset, profile, exit, diagnostic] of [
  ["schema-pass", "fixtures/valido.glb", "profiles/web-commerce.json", 0, null],
  [
    "budget-fail",
    "fixtures/valido.glb",
    "examples/acceptance-gate/budget.json",
    1,
    "TRIANGLES_OVER_BUDGET",
  ],
  [
    "format-fail",
    "fixtures/quebrado.glb",
    "profiles/web-commerce.json",
    1,
    "UNRESOLVED_REFERENCE",
  ],
]) {
  const args = ["judge", asset, "--profile", profile, "--out", "-"];
  const serialized = await run(args, exit);
  assert.equal(
    serialized,
    await run(args, exit),
    `${id}: output changed across identical runs`,
  );
  const report = JSON.parse(serialized);
  assert.equal(report.verdict.pass, exit === 0);
  const codes = [
    ...new Set(report.verdict.violations.map((issue) => issue.code)),
  ];
  if (diagnostic)
    assert(codes.includes(diagnostic), `${id}: expected diagnostic missing`);
  assert.equal(report.asset.sha256, hash(await readFile(join(root, asset))));
  assert.equal(
    report.profile.sha256,
    hash(await readFile(join(root, profile))),
  );
  const filename = `${id}.json`;
  await writeFile(join(output, filename), serialized);
  cases.push({
    id,
    asset,
    profile,
    command: ["node", "packages/cli/dist/index.js", ...args],
    exit,
    pass: report.verdict.pass,
    coverage: report.coverage,
    codes,
    assetSha256: report.asset.sha256,
    profileSha256: report.profile.sha256,
    reportSha256: hash(serialized),
    report: filename,
  });
  process.stdout.write(
    `${id}: exit ${exit}; ${report.verdict.pass ? "PASS" : "FAIL"}; ${codes.join(", ") || "no violations"}\n`,
  );
}
const infra = await run(
  [
    "judge",
    "fixtures/valido.glb",
    "--profile",
    "examples/acceptance-gate/missing-profile.json",
    "--out",
    "-",
  ],
  2,
);
assert.equal(infra, "", "Infrastructure failure must not produce a verdict");
cases.push({ id: "infrastructure-failure", exit: 2, report: null });
process.stdout.write("infrastructure-failure: exit 2; no verdict\n");
await writeFile(
  join(output, "manifest.json"),
  JSON.stringify(
    { node: process.version, deterministic: true, cases },
    null,
    2,
  ) + "\n",
);
process.stdout.write(
  "Demo verified. Reports and hashes: artifacts/demo/manifest.json\n",
);
