import { describe, expect, it } from "vitest";

import type { LayerKind, Violation } from "../src/contract.js";
import type { JudgeReport } from "../src/report.js";
import {
  STRIP_UNUSED_EXTRAS_STEP_ID,
  buildRepairPlan,
  isSafeRepairStep,
  repairExitCode,
  serializeRepair,
  suggestedFixedName,
  type RepairDocument,
} from "../src/repair.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function report(patch: {
  uri?: string;
  pass?: boolean;
  triangles?: number;
  violations?: Violation[];
  ran?: LayerKind[];
}): JudgeReport {
  const ran = patch.ran ?? ["SCHEMA", "PROFILE"];
  const skipped = (
    ["SCHEMA", "PROFILE", "GEOMETRY", "VISUAL", "SEMANTIC"] as const
  ).filter((layer) => !ran.includes(layer));
  const pass = patch.pass ?? (patch.violations ?? []).length === 0;
  return {
    judg3dVersion: "0.2.0",
    asset: {
      uri: patch.uri ?? "product.glb",
      sha256: HASH_A,
      bytes: 4096,
    },
    profile: {
      id: "demo",
      version: "1",
      sha256: HASH_B,
    },
    engine: {
      gltfValidator: "test",
      node: "v22.13.0",
      layers: ran,
    },
    coverage: { ran, skipped: [...skipped] },
    verdict: {
      pass,
      violations: patch.violations ?? [],
      views: [],
      metrics: {
        triangles: patch.triangles ?? 3072,
        vertices: 1538,
        materials: 1,
        drawCalls: 1,
      },
    },
  };
}

const triangles: Violation = {
  kind: "PROFILE",
  code: "TRIANGLES_OVER_BUDGET",
  severity: "error",
  nodePath: "",
  got: { metric: "triangles", value: 3072, usage: 3.072 },
  want: { metric: "triangles", max: 1000 },
};

const texture: Violation = {
  kind: "PROFILE",
  code: "TEXTURE_OVER_BUDGET",
  severity: "error",
  nodePath: "",
  got: { metric: "maxTextureSize", value: 4096 },
  want: { metric: "maxTextureSize", max: 1024 },
};

const schema: Violation = {
  kind: "SCHEMA",
  code: "UNRESOLVED_REFERENCE",
  severity: "error",
  nodePath: "/meshes/0/primitives/0/attributes/POSITION",
  got: { message: "Unresolved reference: 99." },
  want: { conformance: "glTF 2.0" },
};

const external: Violation = {
  kind: "PROFILE",
  code: "EXTERNAL_RESOURCE",
  severity: "error",
  nodePath: "/images/0",
  got: { storage: "external", uri: "tex.png" },
  want: { storage: ["glb", "buffer-view", "data-uri"] },
};

describe("buildRepairPlan", () => {
  it("orders schema before budget and extras, and is deterministic", () => {
    const first = buildRepairPlan(
      report({
        pass: false,
        violations: [triangles, schema, texture],
      }),
      [{ kind: "extras", pointers: ["/asset/extras", "/nodes/0/extras"] }],
    );
    const second = buildRepairPlan(
      report({
        pass: false,
        violations: [triangles, schema, texture],
      }),
      [{ kind: "extras", pointers: ["/nodes/0/extras", "/asset/extras"] }],
    );

    expect(first.steps.map((step) => step.id)).toEqual([
      "finding-UNRESOLVED_REFERENCE",
      STRIP_UNUSED_EXTRAS_STEP_ID,
      "finding-TEXTURE_OVER_BUDGET",
      "finding-TRIANGLES_OVER_BUDGET",
    ]);
    expect(serializeRepair(documentOf(first))).toBe(
      serializeRepair(documentOf(second)),
    );
    expect(first.steps[0]?.autoApply).toBe("manual");
    expect(first.steps[0]?.nodePath).toBe(
      "/meshes/0/primitives/0/attributes/POSITION",
    );
    expect(first.steps[2]?.command).toContain("--width 1024");
    expect(first.steps[3]?.command).toContain("--ratio 0.33");
    expect(first.steps[3]?.rationale).toContain("3072");
    expect(first.steps[3]?.rationale).toContain("1000");
    const extrasStep = first.steps.find((step) => step.id === STRIP_UNUSED_EXTRAS_STEP_ID);
    expect(extrasStep !== undefined && isSafeRepairStep(extrasStep)).toBe(true);
  });

  it("does not invent a size or extras step without a finding", () => {
    const plan = buildRepairPlan(report({ pass: true, triangles: 12 }));
    expect(plan.steps).toEqual([]);
  });

  it("emits a safe extras step only when pointers exist", () => {
    const empty = buildRepairPlan(report({}), [
      { kind: "extras", pointers: [] },
    ]);
    expect(empty.steps).toEqual([]);

    const plan = buildRepairPlan(report({}), [
      { kind: "extras", pointers: ["/extras"] },
    ]);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.id).toBe(STRIP_UNUSED_EXTRAS_STEP_ID);
    expect(plan.steps[0]?.autoApply).toBe("safe");
    expect(plan.steps[0]?.got).toEqual({ pointers: ["/extras"] });
  });

  it("keeps external resources and missing metrics as manual steps", () => {
    const plan = buildRepairPlan(
      report({
        pass: false,
        violations: [
          external,
          {
            kind: "PROFILE",
            code: "METRICS_UNAVAILABLE",
            severity: "error",
            nodePath: "",
            got: { message: "The validator did not produce metrics." },
            want: { measurable: true },
          },
        ],
      }),
    );
    expect(plan.steps.map((step) => step.autoApply)).toEqual([
      "manual",
      "manual",
    ]);
    expect(plan.steps[0]?.code).toBe("METRICS_UNAVAILABLE");
    expect(plan.steps[1]?.code).toBe("EXTERNAL_RESOURCE");
    expect(plan.steps[1]?.rationale).toContain("does not fetch");
  });

  it("groups repeated codes and suggests a materials merge without a fake command", () => {
    const material: Violation = {
      kind: "PROFILE",
      code: "MATERIALS_OVER_BUDGET",
      severity: "error",
      nodePath: "",
      got: { metric: "materials", value: 45 },
      want: { metric: "materials", max: 20 },
    };
    const plan = buildRepairPlan(
      report({ pass: false, violations: [material, material] }),
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.occurrences).toBe(2);
    expect(plan.steps[0]?.autoApply).toBe("manual");
    expect(plan.steps[0]?.command).toBeUndefined();
  });

  it("quotes unsafe command paths", () => {
    const plan = buildRepairPlan(
      report({
        uri: "My Model.glb",
        pass: false,
        violations: [triangles],
      }),
    );
    expect(plan.steps[0]?.command).toContain("'My Model.glb'");
    expect(plan.steps[0]?.command).toContain("'My Model.fixed.glb'");
  });
});

describe("repairExitCode", () => {
  it("is 0 for plan-only even when the asset failed", () => {
    const failed = report({ pass: false, violations: [triangles] });
    expect(
      repairExitCode({
        judg3dVersion: "0.2.0",
        mode: "plan",
        asset: failed.asset,
        profile: failed.profile,
        before: failed,
        plan: buildRepairPlan(failed),
        applied: [],
      }),
    ).toBe(0);
  });

  it("is 1 after apply while the after report still fails", () => {
    const failed = report({ pass: false, violations: [triangles] });
    expect(
      repairExitCode({
        judg3dVersion: "0.2.0",
        mode: "apply",
        asset: failed.asset,
        profile: failed.profile,
        before: failed,
        after: failed,
        plan: buildRepairPlan(failed),
        applied: [],
      }),
    ).toBe(1);
  });

  it("is 0 after apply when the after report passed", () => {
    const failed = report({ pass: false, violations: [triangles] });
    const passed = report({ pass: true, triangles: 12 });
    expect(
      repairExitCode({
        judg3dVersion: "0.2.0",
        mode: "apply",
        asset: failed.asset,
        profile: failed.profile,
        before: failed,
        after: passed,
        plan: buildRepairPlan(failed),
        applied: [],
      }),
    ).toBe(0);
  });
});

describe("suggestedFixedName", () => {
  it("inserts .fixed before the extension", () => {
    expect(suggestedFixedName("assets/box.glb")).toBe("box.fixed.glb");
    expect(suggestedFixedName("model")).toBe("model.fixed.glb");
  });
});

function documentOf(plan: ReturnType<typeof buildRepairPlan>): RepairDocument {
  const before = report({ pass: false, violations: [schema] });
  return {
    judg3dVersion: "0.2.0",
    mode: "plan",
    asset: before.asset,
    profile: before.profile,
    before,
    plan,
    applied: [],
  };
}
