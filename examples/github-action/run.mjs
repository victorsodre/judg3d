import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  EXIT_FAIL,
  EXIT_INFRA,
  EXIT_PASS,
  cliPrefix,
  combineJudgeExits,
  globPrefix,
  globToRegExp,
  markdownSummary,
  parseAssetList,
  parseFailOn,
  profileFileName,
  reportFileName,
  resolveProfile,
  runGate,
  stepExitCode,
} from "../../.github/actions/judg3d-gate/gate.mjs";
import {
  COMMENT_MARKER,
  jobLogUrl,
  metricsVsBudget,
  parseCommentMode,
  prCommentBody,
  pullRequestNumber,
  shouldPostComment,
  upsertPrComment,
} from "../../.github/actions/judg3d-gate/comment.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const cli = join(root, "packages/cli/dist/index.js");
const output = join(root, "artifacts/github-action");
process.env.JUDG3D_PROFILES_DIR = join(root, "profiles");
await mkdir(output, { recursive: true });

assert.deepEqual(parseAssetList("a.glb, b.glb\nc.gltf"), [
  "a.glb",
  "b.glb",
  "c.gltf",
]);
assert.equal(parseFailOn("rejected"), "rejected");
assert.equal(parseFailOn("never"), "never");
assert.equal(parseFailOn("error"), null);
assert.deepEqual(cliPrefix("", "0.1.0"), ["npx", "--yes", "judg3d@0.1.0"]);
assert.deepEqual(cliPrefix(`node ${cli}`, "9.9.9"), ["node", cli]);
assert.equal(profileFileName("web-commerce"), "web-commerce.json");
assert.equal(reportFileName("fixtures/valido.glb", 0), "01-fixtures-valido.glb.json");
assert.equal(combineJudgeExits([0, 1]), EXIT_FAIL);
assert.equal(combineJudgeExits([1, 2]), EXIT_INFRA);
assert.equal(stepExitCode(EXIT_FAIL, "rejected"), EXIT_FAIL);
assert.equal(stepExitCode(EXIT_FAIL, "never"), EXIT_PASS);
assert.equal(stepExitCode(EXIT_INFRA, "never"), EXIT_INFRA);
assert.equal(globPrefix("fixtures/valido*.glb"), "fixtures");
assert.equal(globPrefix("**/*.glb"), "");
assert.ok(globToRegExp("fixtures/valido*.glb").test("fixtures/valido.glb"));
assert.ok(globToRegExp("fixtures/valido*.glb").test("fixtures/valido-textura.glb"));
assert.ok(!globToRegExp("fixtures/valido*.glb").test("fixtures/quebrado.glb"));

const bundled = await mkdtemp(join(tmpdir(), "judg3d-profiles-"));
await writeFile(join(bundled, "web-commerce.json"), "{}\n");
assert.equal(
  await resolveProfile("web-commerce", root, bundled),
  join(bundled, "web-commerce.json"),
);
assert.equal(
  await resolveProfile("profiles/web-commerce.json", root, bundled),
  join(root, "profiles/web-commerce.json"),
);
await assert.rejects(
  () => resolveProfile("missing-profile", root, bundled),
  /Unknown profile missing-profile/,
);
await rm(bundled, { recursive: true, force: true });

const summary = markdownSummary([
  {
    kind: "judge",
    asset: "fixtures/quebrado.glb",
    exit: EXIT_FAIL,
    reportPath: "judg3d-reports/01-quebrado.json",
    serialized: '{"verdict":{"pass":false,"violations":[]}}\n',
    report: {
      profile: { id: "web-commerce", version: "0.1.0" },
      asset: {
        uri: "fixtures/quebrado.glb",
        bytes: 1612,
        sha256: "a".repeat(64),
      },
      coverage: { ran: ["SCHEMA"], skipped: ["PROFILE"] },
      verdict: {
        pass: false,
        violations: [
          {
            severity: "error",
            code: "UNRESOLVED_REFERENCE",
            nodePath: "/meshes/0",
            got: { message: "unresolved accessor" },
            want: {},
          },
        ],
      },
    },
  },
  {
    kind: "infra",
    asset: "gate",
    message: "Profile file not found: missing.json.",
  },
]);
assert.match(summary, /FAILED — `fixtures\/quebrado.glb`/);
assert.match(summary, /UNRESOLVED_REFERENCE/);
assert.match(summary, /Infrastructure failure/);
assert.match(summary, /not an asset rejection/);

const actionYaml = await readFile(
  join(root, ".github/actions/judg3d-gate/action.yml"),
  "utf8",
);
assert.match(actionYaml, /^runs:\n {2}using: composite$/m);
assert.match(actionYaml, /package-manager-cache: false/);
for (const input of [
  "assets",
  "profile",
  "version",
  "fail-on",
  "cli",
  "report-dir",
  "upload-report",
  "artifact-name",
  "node-version",
  "working-directory",
  "comment",
]) {
  assert.match(actionYaml, new RegExp(`^  ${input}:$`, "m"), input);
}

assert.equal(parseCommentMode("auto"), "auto");
assert.equal(parseCommentMode("true"), "true");
assert.equal(parseCommentMode("bogus"), null);
assert.equal(shouldPostComment("auto", "pull_request"), true);
assert.equal(shouldPostComment("auto", "push"), false);
assert.equal(shouldPostComment("false", "pull_request"), false);
assert.equal(shouldPostComment("true", "push"), true);
assert.equal(pullRequestNumber({ GITHUB_REF: "refs/pull/42/merge" }), 42);
assert.equal(
  jobLogUrl({
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_REPOSITORY: "victorsodre/judg3d",
    GITHUB_RUN_ID: "99",
  }),
  "https://github.com/victorsodre/judg3d/actions/runs/99",
);

const comment = prCommentBody({
  results: [
    {
      kind: "judge",
      asset: "fixtures/valido.glb",
      exit: EXIT_FAIL,
      reportPath: "judg3d-reports/01-valido.json",
      serialized: "{}\n",
      report: {
        profile: { id: "budget", version: "0.1.0" },
        asset: {
          uri: "fixtures/valido.glb",
          bytes: 1664,
          sha256: "b".repeat(64),
        },
        coverage: { ran: ["SCHEMA", "PROFILE"], skipped: [] },
        verdict: {
          pass: false,
          metrics: { triangles: 12, vertices: 24, materials: 1, drawCalls: 1 },
          violations: [
            {
              severity: "error",
              code: "TRIANGLES_OVER_BUDGET",
              nodePath: "",
              got: { metric: "triangles", value: 12 },
              want: { metric: "triangles", max: 4 },
            },
          ],
        },
      },
    },
  ],
  compare: {
    verdicts: { before: false, after: true },
    metrics: {
      triangles: { before: 3072, after: 12, delta: -3060 },
      assetBytes: { before: 2000, after: 400, delta: -1600 },
    },
    violations: { removed: [{ code: "TRIANGLES_OVER_BUDGET" }] },
  },
  jobUrl: "https://github.com/victorsodre/judg3d/actions/runs/99",
});
assert.match(comment, new RegExp(COMMENT_MARKER));
assert.match(comment, /❌ judg3d failed/);
assert.match(comment, /fixtures\/valido.glb/);
assert.match(comment, /triangles 12\/4/);
assert.match(comment, /1664 bytes/);
assert.match(comment, /FAILED → PASSED/);
assert.match(comment, /3072 → 12/);
assert.match(comment, /Job log/);
assert.match(
  metricsVsBudget({
    asset: { bytes: 1664 },
    verdict: {
      metrics: { triangles: 12 },
      violations: [
        {
          code: "TRIANGLES_OVER_BUDGET",
          got: { value: 12 },
          want: { metric: "triangles", max: 4 },
        },
      ],
    },
  }),
  /triangles 12\/4/,
);

const fetches = [];
const fakeFetch = async (url, init = {}) => {
  fetches.push({ url, method: init.method || "GET", body: init.body });
  if (String(url).includes("/issues/7/comments") && !init.method) {
    return {
      ok: true,
      json: async () => [{ id: 55, body: `${COMMENT_MARKER}\nold` }],
    };
  }
  return { ok: true, json: async () => ({ id: 55 }) };
};
const updated = await upsertPrComment({
  token: "test-token",
  owner: "acme",
  repo: "shop",
  issueNumber: 7,
  body: comment,
  fetchFn: fakeFetch,
});
assert.equal(updated.action, "updated");
assert.equal(updated.id, 55);
assert.equal(fetches[1].method, "PATCH");
assert.match(fetches[1].body, /judg3d failed/);


const cases = [];
for (const [id, assets, profile, expectedJudge, expectedStep, failOn] of [
  [
    "schema-pass",
    "fixtures/valido.glb",
    "profiles/web-commerce.json",
    EXIT_PASS,
    EXIT_PASS,
    "rejected",
  ],
  [
    "schema-fail",
    "fixtures/quebrado.glb",
    "web-commerce",
    EXIT_FAIL,
    EXIT_FAIL,
    "rejected",
  ],
  [
    "budget-fail",
    "fixtures/valido.glb",
    "examples/acceptance-gate/budget.json",
    EXIT_FAIL,
    EXIT_FAIL,
    "rejected",
  ],
  [
    "report-only-fail",
    "fixtures/quebrado.glb",
    "profiles/web-commerce.json",
    EXIT_FAIL,
    EXIT_PASS,
    "never",
  ],
  [
    "missing-profile",
    "fixtures/valido.glb",
    "examples/github-action/missing-profile.json",
    EXIT_INFRA,
    EXIT_INFRA,
    "rejected",
  ],
  [
    "glob-pass",
    "fixtures/valido*.glb",
    "profiles/web-commerce.json",
    EXIT_PASS,
    EXIT_PASS,
    "rejected",
  ],
]) {
  const reportDir = join(output, id);
  const result = await runGate({
    cwd: root,
    assets,
    profile,
    version: "0.1.0",
    failOn,
    cli: `${process.execPath} ${cli}`,
    reportDir,
    timeoutMs: 40_000,
    summaryPath: join(reportDir, "summary.md"),
  });
  assert.equal(result.judgeExit, expectedJudge, `${id}: judge exit`);
  assert.equal(result.stepExit, expectedStep, `${id}: step exit`);
  if (expectedJudge === EXIT_FAIL) {
    const rejected = result.results.find((item) => item.kind === "judge");
    assert.equal(rejected?.report.verdict.pass, false, `${id}: expected rejection`);
  }
  if (expectedJudge === EXIT_PASS) {
    assert.equal(result.results[0]?.report.verdict.pass, true);
  }
  if (expectedJudge === EXIT_INFRA) {
    assert.equal(result.results[0]?.kind, "infra");
    assert.match(result.summary, /not an asset rejection/);
  }
  await writeFile(join(output, `${id}.md`), result.summary);
  cases.push({
    id,
    assets,
    profile,
    failOn,
    judgeExit: result.judgeExit,
    stepExit: result.stepExit,
  });
}

await exec(process.execPath, [cli, "--help"], { cwd: root, timeout: 10_000 });
await writeFile(join(output, "manifest.json"), `${JSON.stringify(cases, null, 2)}\n`);
process.stdout.write(
  `GitHub Action runner verified: ${cases.length} cases written to artifacts/github-action/.\n`,
);
