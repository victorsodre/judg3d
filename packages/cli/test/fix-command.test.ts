import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RepairDocument } from "@judg3d/core";

import { parseMaxSteps, runFixCommand } from "../src/commands/fix.js";
import { runJudgeCommand } from "../src/commands/judge.js";
import { inspectExtras } from "@judg3d/judge";

const execFileAsync = promisify(execFile);

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const CLI_ENTRY = join(repoRoot, "packages/cli/dist/index.js");
const PROFILE = join(repoRoot, "profiles/web-commerce.json");
const AGENT_PROFILE = join(repoRoot, "profiles/agent-loop.json");
const fixture = (name: string): string => join(repoRoot, "fixtures", name);

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "judg3d-fix-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

type Capture = {
  out: string[];
  err: string[];
};

async function run(
  asset: string,
  overrides: Partial<{
    profile: string;
    out: string;
    json: boolean;
    apply: boolean;
    maxSteps: number;
    outAsset: string;
    fromReport: string;
  }> = {},
): Promise<{ code: number; capture: Capture; out: string }> {
  const out = overrides.out ?? join(workDir, `${crypto.randomUUID()}.json`);
  const capture: Capture = { out: [], err: [] };
  const code = await runFixCommand(
    asset,
    {
      profile: overrides.profile ?? PROFILE,
      out,
      json: overrides.json ?? false,
      apply: overrides.apply ?? false,
      maxSteps: overrides.maxSteps ?? 2,
      ...(overrides.outAsset === undefined ? {} : { outAsset: overrides.outAsset }),
      ...(overrides.fromReport === undefined
        ? {}
        : { fromReport: overrides.fromReport }),
    },
    {
      judg3dVersion: "0.0.0-test",
      stdout: (line) => capture.out.push(line),
      stderr: (line) => capture.err.push(line),
    },
  );
  return { code, capture, out };
}

async function readRepair(path: string): Promise<RepairDocument> {
  return JSON.parse(await readFile(path, "utf8")) as RepairDocument;
}

describe("judg3d fix — plan", () => {
  it("exits 0 on a passing asset with an empty plan", async () => {
    const { code, capture, out } = await run(fixture("valido.glb"));
    expect(code).toBe(0);
    expect(capture.err).toEqual([]);
    expect(capture.out.join("\n")).toContain("PASSED");
    const document = await readRepair(out);
    expect(document.mode).toBe("plan");
    expect(document.plan.steps).toEqual([]);
    expect(document.before.verdict.pass).toBe(true);
  });

  it("exits 0 on a failing asset and lists schema steps", async () => {
    const { code, capture, out } = await run(fixture("quebrado.glb"));
    expect(code).toBe(0);
    const text = capture.out.join("\n");
    expect(text).toContain("FAILED");
    expect(text).toContain("UNRESOLVED_REFERENCE");
    expect(text).toContain("Plan only");
    const document = await readRepair(out);
    expect(document.plan.steps.map((step) => step.code)).toContain(
      "UNRESOLVED_REFERENCE",
    );
    expect(document.plan.steps.every((step) => step.autoApply === "manual")).toBe(
      true,
    );
  });

  it("plans a triangle-budget command from the profile maximum", async () => {
    const tight = join(workDir, "tight-budget.json");
    const base = JSON.parse(await readFile(AGENT_PROFILE, "utf8")) as {
      id: string;
      layers: { profile: { budgets: { maxTriangles: number } } };
    };
    base.id = "fix-tight";
    base.layers.profile.budgets.maxTriangles = 4;
    await writeFile(tight, `${JSON.stringify(base)}\n`);

    const { code, capture, out } = await run(fixture("valido.glb"), {
      profile: tight,
    });
    expect(code).toBe(0);
    expect(capture.out.join("\n")).toContain("TRIANGLES_OVER_BUDGET");
    expect(capture.out.join("\n")).toContain("simplify");
    const document = await readRepair(out);
    const step = document.plan.steps.find(
      (item) => item.code === "TRIANGLES_OVER_BUDGET",
    );
    expect(step?.autoApply).toBe("command");
    expect(step?.command).toContain("--ratio 0.33");
    expect(step?.want).toEqual({ metric: "triangles", max: 4 });
  });

  it("is byte-identical across two plan-only executions", async () => {
    const a = await run(fixture("quebrado.glb"));
    const b = await run(fixture("quebrado.glb"));
    expect(await readFile(a.out, "utf8")).toBe(await readFile(b.out, "utf8"));
  });

  it("reuses --from-report when hashes match", async () => {
    const judged = join(workDir, "from-judge.json");
    const judgeCode = await runJudgeCommand(
      fixture("quebrado.glb"),
      { profile: PROFILE, out: judged, json: false, timestamp: false },
      {
        judg3dVersion: "0.0.0-test",
        stdout: () => undefined,
        stderr: () => undefined,
      },
    );
    expect(judgeCode).toBe(1);
    const planned = await run(fixture("quebrado.glb"));
    const reused = await run(fixture("quebrado.glb"), { fromReport: judged });
    expect(reused.code).toBe(0);
    expect(await readFile(reused.out, "utf8")).toBe(
      await readFile(planned.out, "utf8"),
    );
  });
});

describe("judg3d fix — apply", () => {
  it("exits 1 when apply cannot fix a budget failure", async () => {
    const tight = join(workDir, "apply-tight.json");
    const base = JSON.parse(await readFile(AGENT_PROFILE, "utf8")) as {
      id: string;
      layers: { profile: { budgets: { maxTriangles: number } } };
    };
    base.id = "fix-apply-tight";
    base.layers.profile.budgets.maxTriangles = 4;
    await writeFile(tight, `${JSON.stringify(base)}\n`);

    const { code, capture, out } = await run(fixture("valido.glb"), {
      profile: tight,
      apply: true,
    });
    expect(code).toBe(1);
    expect(capture.out.join("\n")).toContain("TRIANGLES_OVER_BUDGET");
    const document = await readRepair(out);
    expect(document.mode).toBe("apply");
    expect(document.applied).toEqual([]);
    expect(document.after?.verdict.pass).toBe(false);
    expect(document.compare).toBeUndefined();
  });

  it("strips extras, re-judges and compares on --apply", async () => {
    const source = join(workDir, "with-extras.glb");
    const repaired = join(workDir, "with-extras.fixed.glb");
    await writeFile(source, injectExtras(await readFile(fixture("valido.glb"))));
    expect(inspectExtras(new Uint8Array(await readFile(source))).pointers.length).toBeGreaterThan(
      0,
    );

    const { code, capture, out } = await run(source, {
      apply: true,
      outAsset: repaired,
    });
    expect(code).toBe(0);
    expect(capture.out.join("\n")).toContain("strip-unused-extras");
    expect(inspectExtras(new Uint8Array(await readFile(repaired))).pointers).toEqual(
      [],
    );
    const document = await readRepair(out);
    expect(document.applied).toEqual([
      expect.objectContaining({
        id: "strip-unused-extras",
        status: "applied",
      }),
    ]);
    expect(document.compare?.verdicts).toEqual({ before: true, after: true });
    expect(document.compare?.metrics.assetBytes.delta).toBeLessThan(0);
    expect(await readFile(source)).not.toEqual(await readFile(repaired));
  });

  it("exits 2 when the asset is missing", async () => {
    const { code, capture } = await run(join(workDir, "missing.glb"));
    expect(code).toBe(2);
    expect(capture.err.join("\n")).toContain("Could not read asset");
  });
});

describe("judg3d fix — compiled binary", () => {
  it("prints a plan with the documented exit codes", async () => {
    const out = join(workDir, "e2e-fix.json");
    await expect(
      execFileAsync(process.execPath, [
        CLI_ENTRY,
        "fix",
        fixture("valido.glb"),
        "--profile",
        PROFILE,
        "--report",
        out,
      ]),
    ).resolves.toBeDefined();

    await expect(
      execFileAsync(process.execPath, [
        CLI_ENTRY,
        "fix",
        fixture("valido.glb"),
        "--profile",
        AGENT_PROFILE,
        "--apply",
        "--report",
        out,
        "--out-asset",
        join(workDir, "e2e-fixed.glb"),
      ]),
    ).resolves.toBeDefined();
  });

  it("requires --profile", async () => {
    await expect(
      execFileAsync(process.execPath, [CLI_ENTRY, "fix", fixture("valido.glb")]),
    ).rejects.toMatchObject({ code: 2 });
  });
});

describe("parseMaxSteps", () => {
  it("accepts integers in range", () => {
    expect(parseMaxSteps("0")).toBe(0);
    expect(parseMaxSteps("2")).toBe(2);
  });

  it("rejects invalid values", () => {
    expect(() => parseMaxSteps("nope")).toThrow(/--max-steps/);
    expect(() => parseMaxSteps("-1")).toThrow(/--max-steps/);
  });
});

function injectExtras(bytes: Buffer): Buffer {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkLength = view.getUint32(12, true);
  const json = JSON.parse(
    bytes.subarray(20, 20 + chunkLength).toString("utf8"),
  ) as { extras?: unknown; asset: Record<string, unknown> };
  json.extras = { leftover: "metadata" };
  json.asset = { ...json.asset, extras: { leftover: "metadata" } };
  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const pad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunk = jsonBytes.byteLength + pad;
  const rest = bytes.subarray(20 + chunkLength);
  const out = Buffer.alloc(12 + 8 + jsonChunk + rest.byteLength);
  bytes.copy(out, 0, 0, 12);
  out.writeUInt32LE(out.byteLength, 8);
  out.writeUInt32LE(jsonChunk, 12);
  out.writeUInt32LE(view.getUint32(16, true), 16);
  jsonBytes.copy(out, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonChunk);
  rest.copy(out, 20 + jsonChunk);
  return out;
}
