import {
  countBySeverity,
  formatBytes,
  shortHash,
  violationDetail,
  type JudgeReport,
  type Violation,
} from "@judg3d/core";

import {
  bold,
  dim,
  green,
  plural,
  red,
  terminalText,
  yellow,
} from "./format.js";

/** Bound human-readable output; the JSON report is canonical and retains all reported occurrences. */
export function renderReport(report: JudgeReport, outPath: string): string {
  const { verdict } = report;
  const counts = countBySeverity(verdict.violations);
  const lines: string[] = [];

  lines.push(
    dim(
      terminalText(
        `judg3d ${report.judg3dVersion} · profile ${report.profile.id}@${report.profile.version} · gltf-validator ${report.engine.gltfValidator}`,
      ),
    ),
  );
  lines.push(
    dim(
      terminalText(
        `asset  ${report.asset.uri}  ${formatBytes(report.asset.bytes)}  sha256 ${shortHash(report.asset.sha256)}`,
      ),
    ),
  );
  lines.push("");

  const summary = `${plural(counts.error, "error", "errors")}, ${plural(counts.warn, "warning", "warnings")}`;
  lines.push(
    verdict.pass
      ? `${green(bold("PASSED"))} — ${summary}`
      : `${red(bold("FAILED"))} — ${summary}`,
  );

  if (verdict.violations.length > 0) {
    // Align the diagnostic code column.
    const visible = verdict.violations.slice(0, 200);
    const codeWidth = visible.reduce(
      (max, violation) => Math.max(max, terminalText(violation.code).length),
      0,
    );
    lines.push("");
    for (const violation of visible) {
      lines.push(...renderViolation(violation, codeWidth));
    }
    if (visible.length < verdict.violations.length) {
      lines.push(
        `  ${verdict.violations.length - visible.length} additional occurrences in the JSON report.`,
      );
    }
  }

  lines.push("");
  lines.push(dim(`metrics: ${renderMetrics(report)}`));
  lines.push(dim(`layers: ${report.engine.layers.join(", ")}`));
  const skipped = report.coverage.skipped;
  if (skipped.length > 0) {
    // Show coverage so acceptance is not interpreted as certification of unimplemented visual checks.

    lines.push(
      dim(
        `Not covered: ${skipped.join(", ")} — this verdict covers conformance, not appearance`,
      ),
    );
  }
  lines.push(dim(`report: ${terminalText(outPath)}`));

  return lines.join("\n");
}

function renderViolation(violation: Violation, codeWidth: number): string[] {
  const label = violation.severity === "error" ? red("ERROR") : yellow("WARN ");
  const code = bold(terminalText(violation.code).padEnd(codeWidth));
  const head = `  ${label}  ${violation.kind}  ${code}`;
  const where =
    violation.nodePath === undefined
      ? ""
      : `  ${dim(terminalText(violation.nodePath || "Entire document"))}`;
  const lines = [`${head}${where}`];

  const detail = violationDetail(violation);
  if (detail !== undefined) {
    lines.push(`         ${dim(terminalText(detail))}`);
  }
  return lines;
}

function renderMetrics(report: JudgeReport): string {
  const { metrics } = report.verdict;
  const parts = [
    `${metrics.triangles} tris`,
    `${metrics.vertices} verts`,
    plural(metrics.materials, "material", "materials"),
    plural(metrics.drawCalls, "draw call", "draw calls"),
  ];
  if (metrics.textures !== undefined) {
    const { count, maxSize } = metrics.textures;
    parts.push(`${plural(count, "texture", "textures")} up to ${maxSize}px`);
  }
  if (metrics.dimensions !== undefined) {
    const { x, y, z } = metrics.dimensions;
    parts.push(`${x}×${y}×${z}`);
  }
  return parts.join(" · ");
}
