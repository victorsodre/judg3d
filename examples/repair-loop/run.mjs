import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { makeBox } from "./generate.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(root, "artifacts/repair-loop");
const cli = join(root, "packages/cli/dist/index.js");
const profile = "examples/repair-loop/profile.json";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const profileHash = hash(await readFile(join(root, profile)));
await mkdir(output, { recursive: true });

async function judge(asset, expectedExit) {
  let result;
  try {
    result = await exec(
      process.execPath,
      [cli, "judge", asset, "--profile", profile, "--out", "-"],
      {
        cwd: root,
        timeout: 35_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    assert.equal(expectedExit, 0);
  } catch (error) {
    assert.equal(error.code, expectedExit);
    result = error;
  }
  assert.equal(result.stderr, "");
  return result.stdout;
}

const cases = [];
for (const [id, subdivisions, expectedExit, triangles] of [
  ["before", 16, 1, 3072],
  ["after", 1, 0, 12],
]) {
  const bytes = makeBox(subdivisions);
  assert.deepEqual(
    bytes,
    makeBox(subdivisions),
    "Demo input generation must be repeatable.",
  );
  const assetPath = join(output, `${id}.glb`);
  await writeFile(assetPath, bytes);
  const asset = relative(root, assetPath);
  const serialized = await judge(asset, expectedExit);
  assert.equal(serialized, await judge(asset, expectedExit));
  const report = JSON.parse(serialized);
  assert.equal(report.asset.sha256, hash(bytes));
  assert.equal(report.profile.sha256, profileHash);
  assert.equal(report.verdict.pass, expectedExit === 0);
  assert.equal(report.verdict.metrics.triangles, triangles);
  assert.deepEqual(report.coverage.ran, ["SCHEMA", "PROFILE"]);
  assert.deepEqual(
    report.verdict.violations.map((v) => v.code),
    expectedExit === 1 ? ["TRIANGLES_OVER_BUDGET"] : [],
  );
  await writeFile(join(output, `${id}.json`), serialized);
  cases.push({
    id,
    asset,
    exit: expectedExit,
    triangles,
    assetSha256: report.asset.sha256,
    profileSha256: profileHash,
    reportSha256: hash(serialized),
  });
  process.stdout.write(
    `${id}: ${triangles} triangles; ${report.verdict.pass ? "PASS" : "FAIL"}; same 1,000-triangle profile\n`,
  );
}
assert.notEqual(cases[0].assetSha256, cases[1].assetSha256);
assert.equal(hash(await readFile(join(root, profile))), profileHash);

async function compare(expectedExit) {
  let result;
  try {
    result = await exec(
      process.execPath,
      [
        cli,
        "compare",
        "artifacts/repair-loop/before.glb",
        "artifacts/repair-loop/after.glb",
        "--profile",
        profile,
        "--out",
        "-",
      ],
      {
        cwd: root,
        timeout: 70_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    assert.equal(expectedExit, 0);
  } catch (error) {
    assert.equal(error.code, expectedExit);
    result = error;
  }
  assert.equal(result.stderr, "");
  return result.stdout;
}

const compared = await compare(1);
assert.equal(compared, await compare(1));
const compareDocument = JSON.parse(compared);
assert.equal(compareDocument.profile.sha256, profileHash);
assert.deepEqual(compareDocument.verdicts, { before: false, after: true });
assert.deepEqual(compareDocument.metrics.triangles, {
  before: 3072,
  after: 12,
  delta: -3060,
});
assert.deepEqual(
  compareDocument.violations.removed.map((row) => row.code),
  ["TRIANGLES_OVER_BUDGET"],
);
assert.equal(compareDocument.violations.added.length, 0);
assert.equal(compareDocument.coverage.equal, true);
assert.match(
  compareDocument.coverage.note,
  /those layers are not PASS/,
);
await writeFile(join(output, "compare.json"), compared);
cases.push({
  id: "compare",
  exit: 1,
  triangles: { before: 3072, after: 12, delta: -3060 },
  profileSha256: profileHash,
  reportSha256: hash(compared),
});
process.stdout.write(
  "compare: FAIL → PASS; 3,072 → 12 triangles; TRIANGLES_OVER_BUDGET removed\n",
);
await writeFile(
  join(output, "manifest.json"),
  JSON.stringify(
    {
      node: process.version,
      profile,
      profileUnchanged: true,
      correction:
        "The demo author regenerates the six planar box faces without redundant subdivisions. judg3d validates the exports; it does not repair them.",
      provenance:
        "Original procedural demonstration assets, MIT. Not independent adoption or a general-purpose mesh optimizer.",
      cases,
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(
  "Repair-loop demo verified; reports and inputs: artifacts/repair-loop/\n",
);
