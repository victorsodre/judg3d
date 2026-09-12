import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  compareReports,
  InfraError,
  loadProfile,
  type CompareDocument,
} from "@judg3d/core";
import { judge, readAsset } from "@judg3d/judge";

import { runCompareCommand } from "../src/commands/compare.js";

const execFileAsync = promisify(execFile);

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const CLI_ENTRY = join(repoRoot, "packages/cli/dist/index.js");
const PROFILE = join(repoRoot, "profiles/web-commerce.json");
const AGENT_PROFILE = join(repoRoot, "profiles/agent-loop.json");
const fixture = (name: string): string => join(repoRoot, "fixtures", name);

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "judg3d-compare-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

type Capture = {
  out: string[];
  err: string[];
};

async function run(
  before: string,
  after: string,
  overrides: Partial<{
    profile: string;
    out: string;
    json: boolean;
    timestamp: boolean;
  }> = {},
): Promise<{ code: number; capture: Capture; out: string }> {
  const out = overrides.out ?? join(workDir, `${crypto.randomUUID()}.json`);
  const capture: Capture = { out: [], err: [] };
  const code = await runCompareCommand(
    before,
    after,
    {
      profile: overrides.profile ?? PROFILE,
      out,
      json: overrides.json ?? false,
      timestamp: overrides.timestamp ?? false,
    },
    {
      judg3dVersion: "0.0.0-test",
      stdout: (line) => capture.out.push(line),
      stderr: (line) => capture.err.push(line),
    },
  );
  return { code, capture, out };
}

async function readCompare(path: string): Promise<CompareDocument> {
  return JSON.parse(await readFile(path, "utf8")) as CompareDocument;
}

describe("judg3d compare — exit codes", () => {
  it("exits 0 when both assets pass", async () => {
    const { code, capture, out } = await run(
      fixture("valido.glb"),
      fixture("valido-textura.glb"),
    );
    expect(code).toBe(0);
    expect(capture.err).toEqual([]);
    expect(capture.out.join("\n")).toContain("PASSED  →  PASSED");
    expect(capture.out.join("\n")).toContain("those layers are not PASS");

    const document = await readCompare(out);
    expect(document.verdicts).toEqual({ before: true, after: true });
    expect(document.profile.sha256).toBe(document.before.profile.sha256);
    expect(document.profile.sha256).toBe(document.after.profile.sha256);
    expect(document.coverage.equal).toBe(true);
  });

  it("exits 1 when either asset fails and records the violation diff", async () => {
    const { code, capture, out } = await run(
      fixture("valido.glb"),
      fixture("quebrado.glb"),
    );
    expect(code).toBe(1);
    const text = capture.out.join("\n");
    expect(text).toContain("PASSED  →  FAILED");
    expect(text).toContain("UNRESOLVED_REFERENCE");
    expect(text).toContain("added");

    const document = await readCompare(out);
    expect(document.verdicts).toEqual({ before: true, after: false });
    expect(document.violations.added.map((row) => row.code)).toContain(
      "UNRESOLVED_REFERENCE",
    );
    expect(document.metrics.triangles.before).toBeGreaterThan(0);
  });

  it("records a triangle-budget removal against the agent-loop profile", async () => {
    const tight = join(workDir, "tight-budget.json");
    const base = JSON.parse(await readFile(AGENT_PROFILE, "utf8")) as {
      id: string;
      layers: { profile: { budgets: { maxTriangles: number } } };
    };
    base.id = "compare-tight";
    base.layers.profile.budgets.maxTriangles = 4;
    await writeFile(tight, `${JSON.stringify(base)}\n`);

    const { code, capture, out } = await run(
      fixture("valido.glb"),
      fixture("valido.glb"),
      { profile: tight },
    );
    expect(code).toBe(1);
    const document = await readCompare(out);
    expect(document.verdicts).toEqual({ before: false, after: false });
    expect(document.metrics.triangles).toEqual({
      before: 12,
      after: 12,
      delta: 0,
    });
    expect(document.violations.unchanged.map((row) => row.code)).toContain(
      "TRIANGLES_OVER_BUDGET",
    );
    expect(capture.out.join("\n")).toContain("TRIANGLES_OVER_BUDGET");
  });

  it("exits 2 when an asset is missing and does not write a document", async () => {
    const out = join(workDir, "missing-compare.json");
    const { code, capture } = await run(
      fixture("nao-existe.glb"),
      fixture("valido.glb"),
      { out },
    );
    expect(code).toBe(2);
    expect(capture.err.join("\n")).toContain("Could not read asset");
    expect(capture.err.join("\n")).toContain("not an asset rejection");
    await expect(readFile(out, "utf8")).rejects.toThrow();
  });

  it("rejects two fixture reports that used different profile bytes", async () => {
    const [commerce, agent] = await Promise.all([
      loadProfile(PROFILE),
      loadProfile(AGENT_PROFILE),
    ]);
    const [before, after] = await Promise.all([
      judge(await readAsset(fixture("valido.glb")), commerce, {
        judg3dVersion: "0.0.0-test",
      }),
      judge(await readAsset(fixture("valido.glb")), agent, {
        judg3dVersion: "0.0.0-test",
      }),
    ]);
    expect(before.report.profile.sha256).not.toBe(after.report.profile.sha256);
    expect(() => compareReports(before.report, after.report)).toThrow(
      InfraError,
    );
    expect(() => compareReports(before.report, after.report)).toThrow(
      /identical profile bytes/,
    );
  });

  it("exits 2 when the profile enables an unimplemented layer", async () => {
    const profilePath = join(workDir, "with-geometry.json");
    const base = JSON.parse(await readFile(PROFILE, "utf8")) as {
      layers: { geometry: { enabled: boolean } };
    };
    base.layers.geometry.enabled = true;
    await writeFile(profilePath, JSON.stringify(base));

    const { code, capture } = await run(
      fixture("valido.glb"),
      fixture("valido-textura.glb"),
      { profile: profilePath },
    );
    expect(code).toBe(2);
    expect(capture.err.join("\n")).toContain("GEOMETRY");
    expect(capture.err.join("\n")).toContain("false PASS");
  });
});

describe("judg3d compare — document", () => {
  it("is byte-identical across two executions", async () => {
    const a = await run(fixture("quebrado.glb"), fixture("valido.glb"));
    const b = await run(fixture("quebrado.glb"), fixture("valido.glb"));
    expect(await readFile(a.out, "utf8")).toBe(await readFile(b.out, "utf8"));
  });

  it("--json prints the same content that is written", async () => {
    const { capture, out } = await run(
      fixture("valido.glb"),
      fixture("quebrado.glb"),
      { json: true },
    );
    const written = await readFile(out, "utf8");
    expect(`${capture.out.join("\n")}\n`).toBe(written);
  });

  it("omits texture deltas when only one side measured images", async () => {
    const { out } = await run(
      fixture("valido.glb"),
      fixture("valido-textura.glb"),
      { profile: AGENT_PROFILE },
    );
    const document = await readCompare(out);
    expect(document.verdicts).toEqual({ before: true, after: true });
    expect(document.after.verdict.metrics.textures).toEqual({
      count: 1,
      maxSize: 256,
    });
    expect(document.before.verdict.metrics.textures).toBeUndefined();
    expect(document.metrics.textures).toBeUndefined();
  });
});

describe("judg3d compare — compiled binary", () => {
  it("uses the documented exit codes", async () => {
    const out = join(workDir, "e2e-compare.json");
    await expect(
      execFileAsync(process.execPath, [
        CLI_ENTRY,
        "compare",
        fixture("valido.glb"),
        fixture("valido-textura.glb"),
        "--profile",
        PROFILE,
        "--out",
        out,
      ]),
    ).resolves.toBeDefined();

    await expect(
      execFileAsync(process.execPath, [
        CLI_ENTRY,
        "compare",
        fixture("valido.glb"),
        fixture("quebrado.glb"),
        "--profile",
        PROFILE,
        "--out",
        out,
      ]),
    ).rejects.toMatchObject({ code: 1 });
  });

  it("requires --profile", async () => {
    await expect(
      execFileAsync(process.execPath, [
        CLI_ENTRY,
        "compare",
        fixture("valido.glb"),
        fixture("quebrado.glb"),
      ]),
    ).rejects.toMatchObject({ code: 2 });
  });
});
