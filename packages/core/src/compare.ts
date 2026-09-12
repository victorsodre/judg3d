import { LAYER_KINDS, type LayerKind, type MeshMetrics } from "./contract.js";
import { InfraError } from "./errors.js";
import { EXIT_FAIL, EXIT_PASS, type ExitCode } from "./exit-codes.js";
import type { JudgeReport } from "./report.js";

/** Counted metric on both sides. `delta` is after − before. */
export type MetricDelta = {
  before: number;
  after: number;
  delta: number;
};

/** PROFILE metrics already present on MeshMetrics, plus asset byte size. */
export type CompareMetrics = {
  triangles: MetricDelta;
  vertices: MetricDelta;
  materials: MetricDelta;
  drawCalls: MetricDelta;
  assetBytes: MetricDelta;
  /** Present only when both reports measured textures. */
  textures?: {
    count: MetricDelta;
    maxSize: MetricDelta;
  };
};

/** Violation occurrences grouped by diagnostic code. */
export type ViolationCodeDiff = {
  code: string;
  kind: LayerKind;
  before: number;
  after: number;
};

/**
 * Derived comparison of two independent judge reports.
 * This is a new envelope, not a Verdict field.
 */
export type CompareDocument = {
  judg3dVersion: string;
  profile: {
    id: string;
    version: string;
    sha256: string;
  };
  before: JudgeReport;
  after: JudgeReport;
  verdicts: {
    before: boolean;
    after: boolean;
  };
  metrics: CompareMetrics;
  violations: {
    added: ViolationCodeDiff[];
    removed: ViolationCodeDiff[];
    unchanged: ViolationCodeDiff[];
  };
  coverage: {
    equal: boolean;
    comparable: LayerKind[];
    note: string;
  };
  runtime: {
    equal: boolean;
    note?: string;
  };
};

export type CompareOptions = {
  /** Version recorded on the compare document. Defaults to the before report. */
  judg3dVersion?: string;
};

/**
 * Compare two completed judge reports. Profile bytes must match.
 * Unperformed layers are never treated as PASS.
 */
export function compareReports(
  before: JudgeReport,
  after: JudgeReport,
  options: CompareOptions = {},
): CompareDocument {
  if (
    before.profile.sha256 !== after.profile.sha256 ||
    before.profile.id !== after.profile.id ||
    before.profile.version !== after.profile.version
  ) {
    throw new InfraError(
      "Compare requires identical profile bytes on both sides.",
      `before ${before.profile.id}@${before.profile.version} sha256 ${before.profile.sha256} · after ${after.profile.id}@${after.profile.version} sha256 ${after.profile.sha256}`,
    );
  }

  const coverageEqual = sameLayers(before.coverage.ran, after.coverage.ran);
  const comparable = LAYER_KINDS.filter(
    (layer) =>
      before.coverage.ran.includes(layer) && after.coverage.ran.includes(layer),
  );
  const skippedShared = LAYER_KINDS.filter(
    (layer) =>
      before.coverage.skipped.includes(layer) &&
      after.coverage.skipped.includes(layer),
  );
  const runtimeEqual =
    before.engine.gltfValidator === after.engine.gltfValidator &&
    before.engine.node === after.engine.node;

  return {
    judg3dVersion: options.judg3dVersion ?? before.judg3dVersion,
    profile: {
      id: before.profile.id,
      version: before.profile.version,
      sha256: before.profile.sha256,
    },
    before,
    after,
    verdicts: {
      before: before.verdict.pass,
      after: after.verdict.pass,
    },
    metrics: compareMetrics(before, after),
    violations: diffViolations(
      before.verdict.violations,
      after.verdict.violations,
    ),
    coverage: {
      equal: coverageEqual,
      comparable,
      note: coverageCompareNote(
        before.coverage.ran,
        after.coverage.ran,
        comparable,
        skippedShared,
      ),
    },
    runtime: {
      equal: runtimeEqual,
      ...(runtimeEqual
        ? {}
        : {
            note: "Runtime versions differ (gltf-validator or Node). SCHEMA/PROFILE metric comparison remains valid; this document does not claim raster identity.",
          }),
    },
  };
}

/** Exit 0 only when both assets passed the checks that actually ran. */
export function compareExitCode(document: CompareDocument): ExitCode {
  return document.verdicts.before && document.verdicts.after
    ? EXIT_PASS
    : EXIT_FAIL;
}

/** Stable JSON serialization with a trailing newline. */
export function serializeCompare(document: CompareDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function coverageCompareNote(
  beforeRan: readonly LayerKind[],
  afterRan: readonly LayerKind[],
  comparable: readonly LayerKind[],
  skippedShared: readonly LayerKind[],
): string {
  const skipped =
    skippedShared.length === 0
      ? ""
      : ` Not covered on both sides: ${skippedShared.join(", ")} — those layers are not PASS.`;
  if (!sameLayers(beforeRan, afterRan)) {
    const comparableText =
      comparable.length === 0 ? "(none)" : comparable.join(", ");
    return `Coverage differs. Comparable layers: ${comparableText}. Do not treat a missing layer as PASS. Before ran ${joinOrNone(beforeRan)}; after ran ${joinOrNone(afterRan)}.${skipped}`;
  }
  return `PASS applies only to ${joinOrNone(beforeRan)}.${skipped} This comparison does not establish visual or geometric quality.`;
}

function compareMetrics(
  before: JudgeReport,
  after: JudgeReport,
): CompareMetrics {
  const metrics: CompareMetrics = {
    triangles: delta(
      before.verdict.metrics.triangles,
      after.verdict.metrics.triangles,
    ),
    vertices: delta(
      before.verdict.metrics.vertices,
      after.verdict.metrics.vertices,
    ),
    materials: delta(
      before.verdict.metrics.materials,
      after.verdict.metrics.materials,
    ),
    drawCalls: delta(
      before.verdict.metrics.drawCalls,
      after.verdict.metrics.drawCalls,
    ),
    assetBytes: delta(before.asset.bytes, after.asset.bytes),
  };
  const textures = optionalTextures(
    before.verdict.metrics,
    after.verdict.metrics,
  );
  if (textures !== undefined) {
    metrics.textures = textures;
  }
  return metrics;
}

function optionalTextures(
  before: MeshMetrics,
  after: MeshMetrics,
): CompareMetrics["textures"] {
  if (before.textures === undefined || after.textures === undefined) {
    return undefined;
  }
  return {
    count: delta(before.textures.count, after.textures.count),
    maxSize: delta(before.textures.maxSize, after.textures.maxSize),
  };
}

function delta(before: number, after: number): MetricDelta {
  return { before, after, delta: after - before };
}

function diffViolations(
  before: readonly { code: string; kind: LayerKind }[],
  after: readonly { code: string; kind: LayerKind }[],
): CompareDocument["violations"] {
  const beforeCounts = countByCode(before);
  const afterCounts = countByCode(after);
  const codes = [...new Set([...beforeCounts.keys(), ...afterCounts.keys()])];
  codes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const added: ViolationCodeDiff[] = [];
  const removed: ViolationCodeDiff[] = [];
  const unchanged: ViolationCodeDiff[] = [];

  for (const code of codes) {
    const prior = beforeCounts.get(code);
    const next = afterCounts.get(code);
    const row: ViolationCodeDiff = {
      code,
      kind: next?.kind ?? prior?.kind ?? "SCHEMA",
      before: prior?.count ?? 0,
      after: next?.count ?? 0,
    };
    if (row.before === 0) {
      added.push(row);
    } else if (row.after === 0) {
      removed.push(row);
    } else {
      unchanged.push(row);
    }
  }

  return { added, removed, unchanged };
}

function countByCode(
  violations: readonly { code: string; kind: LayerKind }[],
): Map<string, { kind: LayerKind; count: number }> {
  const counts = new Map<string, { kind: LayerKind; count: number }>();
  for (const violation of violations) {
    const current = counts.get(violation.code);
    if (current === undefined) {
      counts.set(violation.code, { kind: violation.kind, count: 1 });
    } else {
      current.count += 1;
    }
  }
  return counts;
}

function sameLayers(
  left: readonly LayerKind[],
  right: readonly LayerKind[],
): boolean {
  return (
    left.length === right.length &&
    left.every((layer, index) => layer === right[index])
  );
}

function joinOrNone(layers: readonly LayerKind[]): string {
  return layers.length === 0 ? "(none)" : layers.join(", ");
}
