import {
  countBySeverity,
  formatBytes,
  formatSignedDelta,
  shortHash,
  violationDetail,
  type CompareDocument,
  type JudgeReport,
  type MetricDelta,
  type RepairDocument,
  type RepairStep,
  type Violation,
  type ViolationCodeDiff,
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

/** Human summary of two independent judge runs. */
export function renderCompare(
  document: CompareDocument,
  outPath: string,
): string {
  const lines: string[] = [];
  lines.push(
    dim(
      terminalText(
        `judg3d ${document.judg3dVersion} · profile ${document.profile.id}@${document.profile.version} · sha256 ${shortHash(document.profile.sha256)}`,
      ),
    ),
  );
  lines.push(dim(terminalText(renderCompareSide("before", document.before))));
  lines.push(dim(terminalText(renderCompareSide("after ", document.after))));
  lines.push("");
  lines.push(renderVerdictShift(document));
  lines.push("");
  lines.push(dim("metrics:"));
  lines.push(dim(`  triangles    ${renderDelta(document.metrics.triangles)}`));
  lines.push(dim(`  vertices     ${renderDelta(document.metrics.vertices)}`));
  lines.push(dim(`  materials    ${renderDelta(document.metrics.materials)}`));
  lines.push(dim(`  draw calls   ${renderDelta(document.metrics.drawCalls)}`));
  lines.push(dim(`  asset bytes  ${renderDelta(document.metrics.assetBytes)}`));
  if (document.metrics.textures !== undefined) {
    lines.push(
      dim(`  textures     ${renderDelta(document.metrics.textures.count)}`),
    );
    lines.push(
      dim(`  max image    ${renderDelta(document.metrics.textures.maxSize)} px`),
    );
  }

  lines.push("");
  lines.push(dim("violations by code:"));
  lines.push(...renderCodeGroup("removed", document.violations.removed));
  lines.push(...renderCodeGroup("added  ", document.violations.added));
  lines.push(...renderCodeGroup("kept   ", document.violations.unchanged));

  lines.push("");
  lines.push(
    dim(
      `layers: ${document.coverage.comparable.join(", ") || "(none)"}` +
        (document.coverage.equal ? " (same coverage)" : " (coverage differs)"),
    ),
  );
  lines.push(dim(document.coverage.note));
  if (document.runtime.note !== undefined) {
    lines.push(dim(document.runtime.note));
  }
  lines.push(dim(`report: ${terminalText(outPath)}`));
  return lines.join("\n");
}

function renderCompareSide(label: string, report: JudgeReport): string {
  const result = report.verdict.pass ? "PASSED" : "FAILED";
  return `${label}  ${report.asset.uri}  ${formatBytes(report.asset.bytes)}  sha256 ${shortHash(report.asset.sha256)}  ${result}`;
}

function renderVerdictShift(document: CompareDocument): string {
  const from = document.verdicts.before
    ? green(bold("PASSED"))
    : red(bold("FAILED"));
  const to = document.verdicts.after
    ? green(bold("PASSED"))
    : red(bold("FAILED"));
  return `${from}  →  ${to}`;
}

function renderDelta(metric: MetricDelta): string {
  return `${metric.before} → ${metric.after}  (${formatSignedDelta(metric.delta)})`;
}

function renderCodeGroup(
  label: string,
  rows: readonly ViolationCodeDiff[],
): string[] {
  if (rows.length === 0) {
    return [dim(`  ${label}  (none)`)];
  }
  return rows.map((row) => {
    const counts =
      row.before === row.after
        ? `${row.before}`
        : `${row.before} → ${row.after}`;
    return `  ${label}  ${bold(terminalText(row.code))}  ${row.kind}  ${counts}`;
  });
}

/** Human summary of a repair plan and optional before/after compare. */
export function renderRepair(
  document: RepairDocument,
  outPath: string,
  outAsset?: string,
): string {
  const lines: string[] = [];
  lines.push(
    dim(
      terminalText(
        `judg3d ${document.judg3dVersion} · profile ${document.profile.id}@${document.profile.version} · ${document.mode}`,
      ),
    ),
  );
  lines.push(dim(terminalText(renderCompareSide("asset ", document.before))));
  if (document.after !== undefined && document.after !== document.before) {
    lines.push(dim(terminalText(renderCompareSide("after ", document.after))));
  }
  lines.push("");

  const passed = (document.after ?? document.before).verdict.pass;
  const safe = document.plan.steps.filter((step) => step.autoApply === "safe");
  const headline = passed
    ? `${green(bold("PASSED"))} — ${plural(document.plan.steps.length, "repair step", "repair steps")}`
    : `${red(bold("FAILED"))} — ${plural(document.plan.steps.length, "repair step", "repair steps")}`;
  lines.push(headline);
  if (document.mode === "plan") {
    lines.push(
      dim(
        safe.length === 0
          ? "Plan only. No safe automatic steps; run suggested commands or re-export, then compare."
          : `Plan only. ${plural(safe.length, "safe step", "safe steps")} can run with --apply.`,
      ),
    );
  }

  if (document.plan.steps.length === 0) {
    lines.push("");
    lines.push(dim("No findings to repair. The asset already passed the checks that ran."));
  } else {
    lines.push("");
    for (const [index, step] of document.plan.steps.entries()) {
      lines.push(...renderRepairStep(index + 1, step));
    }
  }

  if (document.applied.length > 0) {
    lines.push("");
    lines.push(dim("applied:"));
    for (const item of document.applied) {
      lines.push(
        dim(`  ${item.status.padEnd(7)}  ${bold(terminalText(item.id))}  ${terminalText(item.detail)}`),
      );
    }
  }

  if (document.compare !== undefined) {
    lines.push("");
    lines.push(renderVerdictShift(document.compare));
    lines.push(dim(`  triangles    ${renderDelta(document.compare.metrics.triangles)}`));
    lines.push(dim(`  asset bytes  ${renderDelta(document.compare.metrics.assetBytes)}`));
    lines.push(dim(document.compare.coverage.note));
  }

  if (outAsset !== undefined && document.applied.some((item) => item.status === "applied")) {
    lines.push(dim(`repaired: ${terminalText(outAsset)}`));
  }
  lines.push(dim(`report: ${terminalText(outPath)}`));
  return lines.join("\n");
}

function renderRepairStep(index: number, step: RepairStep): string[] {
  const label =
    step.autoApply === "safe"
      ? green("safe   ")
      : step.autoApply === "command"
        ? yellow("command")
        : dim("manual ");
  const lines = [
    `  ${index}. ${label}  ${bold(terminalText(step.code))}  ${step.kind}  ${terminalText(step.title)}`,
  ];
  if (step.nodePath !== undefined && step.nodePath !== "") {
    lines.push(`     ${dim(terminalText(step.nodePath))}`);
  }
  lines.push(`     ${dim(terminalText(step.rationale))}`);
  if (step.command !== undefined) {
    lines.push(`     ${dim(terminalText(step.command))}`);
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
