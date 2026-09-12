import { describe, expect, it } from "vitest";

import {
  compareExitCode,
  compareReports,
  serializeCompare,
  type CompareDocument,
} from "../src/compare.js";
import { InfraError } from "../src/errors.js";
import { isCompareDocument } from "../src/present.js";
import type { JudgeReport } from "../src/report.js";
import type { LayerKind, Violation } from "../src/contract.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function report(patch: {
  uri?: string;
  sha256?: string;
  bytes?: number;
  profileHash?: string;
  profileId?: string;
  profileVersion?: string;
  pass?: boolean;
  triangles?: number;
  vertices?: number;
  materials?: number;
  drawCalls?: number;
  textures?: { count: number; maxSize: number };
  violations?: Violation[];
  ran?: LayerKind[];
  node?: string;
}): JudgeReport {
  const ran = patch.ran ?? ["SCHEMA", "PROFILE"];
  const skipped = (
    ["SCHEMA", "PROFILE", "GEOMETRY", "VISUAL", "SEMANTIC"] as const
  ).filter((layer) => !ran.includes(layer));
  const pass = patch.pass ?? (patch.violations ?? []).length === 0;
  return {
    judg3dVersion: "0.1.0",
    asset: {
      uri: patch.uri ?? "before.glb",
      sha256: patch.sha256 ?? HASH_A,
      bytes: patch.bytes ?? 1000,
    },
    profile: {
      id: patch.profileId ?? "demo",
      version: patch.profileVersion ?? "1",
      sha256: patch.profileHash ?? HASH_B,
    },
    engine: {
      gltfValidator: "test",
      node: patch.node ?? "v22.13.0",
      layers: ran,
    },
    coverage: { ran, skipped: [...skipped] },
    verdict: {
      pass,
      violations: patch.violations ?? [],
      views: [],
      metrics: {
        triangles: patch.triangles ?? 3072,
        vertices: patch.vertices ?? 1538,
        materials: patch.materials ?? 1,
        drawCalls: patch.drawCalls ?? 1,
        ...(patch.textures === undefined ? {} : { textures: patch.textures }),
      },
    },
  };
}

const budget: Violation = {
  kind: "PROFILE",
  code: "TRIANGLES_OVER_BUDGET",
  severity: "error",
  nodePath: "",
  got: { metric: "triangles", value: 3072 },
  want: { metric: "triangles", max: 1000 },
};

const unresolved: Violation = {
  kind: "SCHEMA",
  code: "UNRESOLVED_REFERENCE",
  severity: "error",
  nodePath: "/meshes/0",
  got: { message: "Unresolved reference: 99." },
  want: { conformance: "glTF 2.0" },
};

describe("compareReports", () => {
  it("records metric deltas and a removed budget violation", () => {
    const document = compareReports(
      report({
        uri: "before.glb",
        pass: false,
        violations: [budget],
        triangles: 3072,
        vertices: 1538,
      }),
      report({
        uri: "after.glb",
        sha256: HASH_C,
        bytes: 400,
        pass: true,
        triangles: 12,
        vertices: 24,
      }),
    );

    expect(document.verdicts).toEqual({ before: false, after: true });
    expect(document.metrics.triangles).toEqual({
      before: 3072,
      after: 12,
      delta: -3060,
    });
    expect(document.metrics.vertices).toEqual({
      before: 1538,
      after: 24,
      delta: -1514,
    });
    expect(document.metrics.assetBytes.delta).toBe(-600);
    expect(document.violations.removed).toEqual([
      {
        code: "TRIANGLES_OVER_BUDGET",
        kind: "PROFILE",
        before: 1,
        after: 0,
      },
    ]);
    expect(document.violations.added).toEqual([]);
    expect(document.violations.unchanged).toEqual([]);
    expect(document.coverage.equal).toBe(true);
    expect(document.coverage.comparable).toEqual(["SCHEMA", "PROFILE"]);
    expect(document.coverage.note).toContain("GEOMETRY, VISUAL, SEMANTIC");
    expect(document.coverage.note).toContain(
      "does not establish visual or geometric quality",
    );
    expect(compareExitCode(document)).toBe(1);
    expect(isCompareDocument(document)).toBe(true);
  });

  it("groups added and unchanged codes without claiming unrun layers", () => {
    const document = compareReports(
      report({
        pass: false,
        violations: [unresolved],
        ran: ["SCHEMA"],
      }),
      report({
        uri: "after.glb",
        sha256: HASH_C,
        pass: false,
        violations: [unresolved, unresolved, budget],
        ran: ["SCHEMA", "PROFILE"],
      }),
    );

    expect(document.violations.added).toEqual([
      { code: "TRIANGLES_OVER_BUDGET", kind: "PROFILE", before: 0, after: 1 },
    ]);
    expect(document.violations.unchanged).toEqual([
      { code: "UNRESOLVED_REFERENCE", kind: "SCHEMA", before: 1, after: 2 },
    ]);
    expect(document.coverage.equal).toBe(false);
    expect(document.coverage.comparable).toEqual(["SCHEMA"]);
    expect(document.coverage.note).toContain("Coverage differs");
    expect(document.coverage.note).toContain("Do not treat a missing layer as PASS");
    expect(document.metrics.textures).toBeUndefined();
  });

  it("includes texture deltas only when both reports measured images", () => {
    const withTextures = report({
      uri: "textured.glb",
      sha256: HASH_C,
      textures: { count: 2, maxSize: 1024 },
      triangles: 12,
    });
    const without = report({ triangles: 12 });
    expect(compareReports(without, withTextures).metrics.textures).toBeUndefined();

    const both = compareReports(
      report({ textures: { count: 1, maxSize: 2048 }, triangles: 12 }),
      report({
        uri: "after.glb",
        sha256: HASH_C,
        textures: { count: 2, maxSize: 512 },
        triangles: 12,
      }),
    );
    expect(both.metrics.textures).toEqual({
      count: { before: 1, after: 2, delta: 1 },
      maxSize: { before: 2048, after: 512, delta: -1536 },
    });
  });

  it("rejects mismatched profile hashes as infrastructure failure", () => {
    expect(() =>
      compareReports(
        report({ profileHash: HASH_B }),
        report({ uri: "after.glb", profileHash: HASH_C }),
      ),
    ).toThrow(InfraError);
    expect(() =>
      compareReports(
        report({ profileHash: HASH_B }),
        report({ uri: "after.glb", profileHash: HASH_C }),
      ),
    ).toThrow(/identical profile bytes/);
  });

  it("rejects a profile identity change even when the hash field matches", () => {
    expect(() =>
      compareReports(
        report({ profileId: "demo" }),
        report({ uri: "after.glb", profileId: "other" }),
      ),
    ).toThrow(/identical profile bytes/);
  });

  it("records a runtime difference without inventing visual PASS", () => {
    const document = compareReports(
      report({ node: "v22.13.0", triangles: 12 }),
      report({ uri: "after.glb", sha256: HASH_C, node: "v24.0.0", triangles: 12 }),
    );
    expect(document.runtime.equal).toBe(false);
    expect(document.runtime.note).toContain("does not claim raster identity");
    expect(document.coverage.note).toContain("those layers are not PASS");
    expect(compareExitCode(document)).toBe(0);
  });

  it("serializes deterministically", () => {
    const before = report({ pass: false, violations: [budget] });
    const after = report({
      uri: "after.glb",
      sha256: HASH_C,
      triangles: 12,
    });
    const first = serializeCompare(compareReports(before, after));
    const second = serializeCompare(compareReports(before, after));
    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
  });

  it("rejects a tampered compare document", () => {
    const document = compareReports(
      report({ pass: false, violations: [budget] }),
      report({ uri: "after.glb", sha256: HASH_C, triangles: 12 }),
    );
    const tampered: CompareDocument = {
      ...document,
      coverage: {
        ...document.coverage,
        note: "GEOMETRY passed on both sides.",
      },
    };
    expect(isCompareDocument(document)).toBe(true);
    expect(isCompareDocument(tampered)).toBe(false);
    expect(isCompareDocument({ ...document, before: "no" })).toBe(false);
  });
});
