import {
  countBySeverity,
  formatBytes,
  shortHash,
  violationDetail,
  type JudgeReport,
  type Violation,
} from "@judg3d/core";

import { bold, dim, green, plural, red, yellow } from "./format.js";

/**
 * Relatorio legivel no terminal. O `judge-report.json` e o que o agente le;
 * isto aqui e o que a pessoa le. Os dois carregam a mesma informacao.
 */
export function renderReport(report: JudgeReport, outPath: string): string {
  const { verdict } = report;
  const counts = countBySeverity(verdict.violations);
  const lines: string[] = [];

  lines.push(
    dim(
      `judg3d ${report.judg3dVersion} · perfil ${report.profile.id}@${report.profile.version} · gltf-validator ${report.engine.gltfValidator}`,
    ),
  );
  lines.push(
    dim(
      `asset  ${report.asset.uri}  ${formatBytes(report.asset.bytes)}  sha256 ${shortHash(report.asset.sha256)}`,
    ),
  );
  lines.push("");

  const resumo = `${plural(counts.error, "erro", "erros")}, ${plural(counts.warn, "aviso", "avisos")}`;
  lines.push(
    verdict.pass
      ? `${green(bold("APROVADO"))} — ${resumo}`
      : `${red(bold("REPROVADO"))} — ${resumo}`,
  );

  if (verdict.violations.length > 0) {
    // Alinha a coluna do pointer pelo codigo mais longo desta rodada.
    const codeWidth = Math.max(
      ...verdict.violations.map((violation) => violation.code.length),
    );
    lines.push("");
    for (const violation of verdict.violations) {
      lines.push(...renderViolation(violation, codeWidth));
    }
  }

  lines.push("");
  lines.push(dim(`métricas: ${renderMetrics(report)}`));
  lines.push(dim(`camadas: ${report.engine.layers.join(", ")}`));
  lines.push(dim(`relatório: ${outPath}`));

  return lines.join("\n");
}

function renderViolation(violation: Violation, codeWidth: number): string[] {
  const label = violation.severity === "error" ? red("ERRO ") : yellow("AVISO");
  const code = bold(violation.code.padEnd(codeWidth));
  const head = `  ${label}  ${violation.kind}  ${code}`;
  const where =
    violation.nodePath === undefined ? "" : `  ${dim(violation.nodePath)}`;
  const lines = [`${head}${where}`];

  const detail = violationDetail(violation);
  if (detail !== undefined) {
    lines.push(`         ${dim(detail)}`);
  }
  return lines;
}

function renderMetrics(report: JudgeReport): string {
  const { metrics } = report.verdict;
  const parts = [
    `${metrics.triangles} tris`,
    `${metrics.vertices} verts`,
    plural(metrics.materials, "material", "materiais"),
    plural(metrics.drawCalls, "draw call", "draw calls"),
  ];
  if (metrics.textures !== undefined) {
    const { count, maxSize } = metrics.textures;
    parts.push(`${plural(count, "textura", "texturas")} até ${maxSize}px`);
  }
  if (metrics.dimensions !== undefined) {
    const { x, y, z } = metrics.dimensions;
    parts.push(`${x}×${y}×${z}`);
  }
  return parts.join(" · ");
}
