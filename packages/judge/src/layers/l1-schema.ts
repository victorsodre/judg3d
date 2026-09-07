import {
  validateBytes,
  type GltfIssue,
  type GltfIssueSeverity,
  type GltfValidationInfo,
  type GltfValidationReport,
} from "gltf-validator";

import type {
  MeshMetrics,
  ReportLevel,
  SchemaLayerConfig,
  Severity,
  Violation,
} from "@judg3d/core";
import { EMPTY_METRICS, InfraError } from "@judg3d/core";

/** SCHEMA delegates format validation to the official Khronos validator. */

/** Severity names in Khronos order. */
const SEVERITY_NAMES = ["Error", "Warning", "Information", "Hint"] as const;

/** Report verbosity ceiling. */
const REPORT_LEVEL_CEILING: Readonly<Record<ReportLevel, GltfIssueSeverity>> = {
  error: 0,
  warn: 1,
  info: 2,
  hint: 3,
};

/** An unrecognized asset format fails SCHEMA; it is not an infrastructure failure. */
export const UNPARSEABLE_CODE = "GLTF_UNPARSEABLE";

/** Synthetic diagnostic discloses omitted occurrences without changing the verdict. */
export const TRUNCATED_CODE = "ISSUES_TRUNCATED";

export type SchemaLayerResult = {
  pass: boolean;
  violations: Violation[];
  metrics: MeshMetrics;
  /** Original Khronos report remains available to subsequent layers. */
  report: GltfValidationReport | undefined;
};

export async function runSchemaLayer(
  bytes: Uint8Array,
  uri: string,
  config: SchemaLayerConfig,
): Promise<SchemaLayerResult> {
  let report: GltfValidationReport;
  try {
    report = await validateBytes(bytes, {
      uri,
      writeTimestamp: false,
      maxIssues: config.maxIssues,
      ignoredIssues: config.ignoredIssues,
      severityOverrides: config.severityOverrides,
    });
  } catch (cause) {
    if (cause !== "Invalid data: could not detect glTF format.") {
      throw new InfraError("Internal glTF Validator failure.");
    }
    return {
      pass: false,
      violations: [unparseableViolation(cause, config)],
      metrics: { ...EMPTY_METRICS },
      report: undefined,
    };
  }

  if (report.issues.truncated) {
    throw new InfraError(
      "Validation was interrupted by maxIssues; no complete verdict was produced.",
      "Use maxIssues: 0 and maxPerCode to summarize the report after validation.",
    );
  }

  const ceiling = Math.max(
    REPORT_LEVEL_CEILING[config.report],
    config.failOn === "warn" ? 1 : 0,
  );
  const relevantIssues = report.issues.messages.filter(
    (issue) => issue.severity <= ceiling,
  );

  return {
    pass:
      report.issues.numErrors === 0 &&
      (config.failOn !== "warn" || report.issues.numWarnings === 0),
    violations: capIssuesPerCode(relevantIssues, config),
    metrics: toMetrics(report.info),
    report,
  };
}

/** Cap occurrences after validation while preserving issue order. */
export function capIssuesPerCode(
  issues: readonly GltfIssue[],
  config: SchemaLayerConfig,
): Violation[] {
  if (config.maxPerCode === 0) {
    return issues.map((issue) => toViolation(issue, config));
  }

  const seen = new Map<string, number>();
  const omitted = new Map<string, number>();
  const violations: Violation[] = [];

  for (const issue of issues) {
    const n = (seen.get(issue.code) ?? 0) + 1;
    seen.set(issue.code, n);
    if (n <= config.maxPerCode) {
      violations.push(toViolation(issue, config));
    } else {
      omitted.set(issue.code, (omitted.get(issue.code) ?? 0) + 1);
    }
  }

  if (omitted.size > 0) {
    // Sort omitted counts by descending volume, then code for deterministic ties.

    const byVolume = [...omitted.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    violations.push({
      kind: "SCHEMA",
      code: TRUNCATED_CODE,
      severity: "warn",
      nodePath: "",
      got: {
        message: `${byVolume.reduce((s, [, n]) => s + n, 0)} issues omitted beyond the limit of ${config.maxPerCode} per code.`,
        omitted: Object.fromEntries(byVolume),
      },
      want: { maxPerCode: config.maxPerCode },
    });
  }

  return violations;
}

function toViolation(issue: GltfIssue, config: SchemaLayerConfig): Violation {
  return {
    kind: "SCHEMA",
    code: issue.code,
    severity: toSeverity(issue.severity),
    ...locate(issue),
    got: {
      severity: SEVERITY_NAMES[issue.severity],
      message: issue.message,
    },
    want: {
      conformance: "glTF 2.0",
      failOn: config.failOn,
    },
  };
}

/** Locate issues by JSON pointer, document root or container byte offset. */
function locate(issue: GltfIssue): { nodePath: string } {
  if (issue.pointer !== undefined && issue.pointer !== "") {
    return { nodePath: issue.pointer };
  }
  if (issue.offset !== undefined) {
    return { nodePath: `offset:${issue.offset}` };
  }
  return { nodePath: "" };
}

/** Information and Hint render as warn, while pass/fail uses their original severity. */
function toSeverity(severity: GltfIssueSeverity): Severity {
  return severity === 0 ? "error" : "warn";
}

function unparseableViolation(
  cause: unknown,
  config: SchemaLayerConfig,
): Violation {
  return {
    kind: "SCHEMA",
    code: UNPARSEABLE_CODE,
    severity: "error",
    nodePath: "",
    got: {
      severity: "Error",
      message:
        cause instanceof Error
          ? cause.message
          : typeof cause === "string"
            ? cause
            : "The glTF Validator could not read the file.",
    },
    want: {
      conformance: "glTF 2.0",
      failOn: config.failOn,
    },
  };
}

/** Reuse validator measurements; do not invent dimensions or VRAM estimates. */
function toMetrics(info: GltfValidationInfo | undefined): MeshMetrics {
  if (info === undefined) {
    return { ...EMPTY_METRICS };
  }
  return {
    triangles: info.totalTriangleCount,
    vertices: info.totalVertexCount,
    materials: info.materialCount,
    drawCalls: info.drawCallCount,
  };
}
