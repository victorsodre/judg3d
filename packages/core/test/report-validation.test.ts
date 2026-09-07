import { describe, expect, it } from "vitest";
import { isJudgeReport, violationDetail } from "../src/present.js";
import type { JudgeReport } from "../src/report.js";

const report = (): JudgeReport => ({
  judg3dVersion: "0.1.0",
  asset: { uri: "box.glb", bytes: 1664, sha256: "a".repeat(64) },
  profile: { id: "schema", version: "1", sha256: "b".repeat(64) },
  engine: { node: "v22.13.0", gltfValidator: "test", layers: ["SCHEMA"] },
  coverage: {
    ran: ["SCHEMA"],
    skipped: ["PROFILE", "GEOMETRY", "VISUAL", "SEMANTIC"],
  },
  verdict: {
    pass: true,
    violations: [],
    views: [],
    metrics: { triangles: 12, vertices: 24, materials: 1, drawCalls: 1 },
  },
});

const issue = {
  kind: "SCHEMA",
  code: "TEST_ERROR",
  severity: "error",
  nodePath: "",
  got: { message: "Invalid asset." },
  want: { valid: true },
} as const;

describe("report trust boundary", () => {
  it("accepts consistent reports for successful checks and asset rejection", () => {
    expect(isJudgeReport(report())).toBe(true);
    const failed = report();
    failed.verdict.pass = false;
    failed.verdict.violations.push(issue);
    expect(isJudgeReport(failed)).toBe(true);
  });

  it.each(["empty", "duplicate", "overlap", "missing", "engine"])(
    "rejects contradictory coverage: %s",
    (mode) => {
      const value = report();
      if (mode === "empty") {
        value.coverage.ran = [];
        value.engine.layers = [];
      }
      if (mode === "duplicate") value.coverage.ran.push("SCHEMA");
      if (mode === "overlap") value.coverage.skipped.push("SCHEMA");
      if (mode === "missing") value.coverage.skipped.pop();
      if (mode === "engine") value.engine.layers = ["PROFILE"];
      expect(isJudgeReport(value)).toBe(false);
    },
  );

  it("rejects PASS with errors, unexplained FAIL, and issues in unchecked layers", () => {
    const value = report();
    value.verdict.violations = [issue];
    expect(isJudgeReport(value)).toBe(false);
    value.verdict.pass = false;
    value.verdict.violations = [];
    expect(isJudgeReport(value)).toBe(false);
    value.verdict.violations = [{ ...issue, kind: "PROFILE" }];
    expect(isJudgeReport(value)).toBe(false);
  });

  it("rejects fractional counters and unsafe integer measurements", () => {
    const value = report();
    value.verdict.metrics.triangles = 1.5;
    expect(isJudgeReport(value)).toBe(false);
    value.verdict.metrics.triangles = 12;
    value.asset.bytes = Number.MAX_SAFE_INTEGER + 1;
    expect(isJudgeReport(value)).toBe(false);
  });

  it("renders cyclic and deeply nested details without overflowing the stack", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(violationDetail({ ...issue, got: cyclic })).toContain("…");
    let nested: unknown = 1;
    for (let i = 0; i < 100; i++) nested = { value: nested };
    expect(violationDetail({ ...issue, got: nested })).toContain("…");
    expect(
      violationDetail({
        ...issue,
        got: { values: Array.from({ length: 10_000 }, (_, i) => i) },
      })?.length,
    ).toBeLessThan(4000);
  });
});
