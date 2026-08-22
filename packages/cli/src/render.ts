import {
  countBySeverity,
  shortHash,
  type JudgeReport,
  type Violation,
} from "@judg3d/core";

import { bold, dim, formatBytes, green, plural, red, yellow } from "./format.js";

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

  const detail = messageOf(violation.got) ?? comparison(violation);
  if (detail !== undefined) {
    lines.push(`         ${dim(detail)}`);
  }
  return lines;
}

/**
 * `got`/`want` numa linha, para violacoes que nao trazem `message`.
 *
 * Invariante 4 da spec: toda violacao e acionavel — codigo, local e got/want.
 * O codigo sozinho nao e acionavel: `MATERIALS_OVER_BUDGET` nao diz se o asset
 * tem 21 materiais ou 350. Antes da L2 nenhuma violacao chegava aqui sem
 * `message`, e o buraco so apareceu quando uma chegou.
 */
function comparison(violation: Violation): string | undefined {
  const got = flatten(violation.got);
  if (got === undefined) {
    return undefined;
  }
  // Pares identicos nos dois lados sao contexto repetido, nao contraste.
  const want = flatten(violation.want, asRecord(violation.got));
  return want === undefined ? got : `${got}  →  esperado ${want}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function flatten(value: unknown, omitSameAs: Record<string, unknown> = {}): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => flatten(item) ?? "—").join(", ");
  }
  if (typeof value === "object") {
    const parts = Object.entries(value)
      .filter(([key, item]) => item !== undefined && omitSameAs[key] !== item)
      .map(([key, item]) => `${key} ${flatten(item) ?? "—"}`);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }
  // `got` e `want` sao `unknown` no contrato de proposito — cada camada poe o
  // que faz sentido. Sem lista explicita, um objeto exotico viraria
  // "[object Object]" na saida, que e pior que nao imprimir nada.
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  return undefined;
}

function messageOf(got: unknown): string | undefined {
  if (typeof got === "object" && got !== null && "message" in got) {
    const { message } = got;
    if (typeof message === "string") {
      return message;
    }
  }
  return undefined;
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
