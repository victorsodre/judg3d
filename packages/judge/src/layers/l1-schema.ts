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
import { EMPTY_METRICS } from "@judg3d/core";

/**
 * L1 SCHEMA — o asset e um glTF 2.0 valido?
 *
 * Nada aqui reimplementa validacao: quem julga e o glTF Validator oficial da
 * Khronos. O trabalho desta camada e traduzir o relatorio dele para o contrato
 * do judg3d e aplicar a tolerancia que veio do profile.
 */

/** Severidade Khronos -> nome legivel, na ordem do enum deles. */
const SEVERITY_NAMES = ["Error", "Warning", "Information", "Hint"] as const;

/** Severidade minima do profile -> maior indice Khronos que ainda entra. */
const REPORT_LEVEL_CEILING: Readonly<Record<ReportLevel, GltfIssueSeverity>> = {
  error: 0,
  warn: 1,
  info: 2,
  hint: 3,
};

/**
 * Codigo sintetico para o caso em que o validator nem reconhece o arquivo.
 * Isso e reprovacao, nao erro de infra: um arquivo que nao e glTF falhou no
 * SCHEMA da forma mais literal possivel, e deixar isso virar exit 2 abriria a
 * porta pra "o CI quebrou" mascarar "o asset e lixo".
 */
export const UNPARSEABLE_CODE = "GLTF_UNPARSEABLE";

/**
 * O relatorio foi cortado pelo `maxPerCode` do profile. Nunca e silencioso:
 * um laudo truncado sem aviso le como "esta tudo aqui", e a diferenca entre
 * "cinco ocorrencias" e "seiscentas mil" muda a decisao de quem le.
 */
export const TRUNCATED_CODE = "ISSUES_TRUNCATED";

export type SchemaLayerResult = {
  violations: Violation[];
  metrics: MeshMetrics;
  /** Relatorio cru da Khronos, quando o arquivo pode ser lido. */
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
    return {
      violations: [unparseableViolation(cause, config)],
      metrics: { ...EMPTY_METRICS },
      report: undefined,
    };
  }

  const ceiling = REPORT_LEVEL_CEILING[config.report];
  const relevantes = report.issues.messages.filter(
    (issue) => issue.severity <= ceiling,
  );

  return {
    violations: aplicarTetoPorCodigo(relevantes, config),
    metrics: toMetrics(report.info),
    report,
  };
}

/**
 * Mantem no maximo `maxPerCode` violacoes de cada codigo, na ordem em que o
 * validator as produziu, e declara o que ficou de fora.
 *
 * A ordem importa: o validator emite por posicao no arquivo, entao as
 * primeiras N de um codigo apontam os primeiros lugares onde o problema
 * aparece — que e por onde alguem comeca a consertar.
 */
export function aplicarTetoPorCodigo(
  issues: readonly GltfIssue[],
  config: SchemaLayerConfig,
): Violation[] {
  if (config.maxPerCode === 0) {
    return issues.map((issue) => toViolation(issue, config));
  }

  const vistos = new Map<string, number>();
  const cortados = new Map<string, number>();
  const violations: Violation[] = [];

  for (const issue of issues) {
    const n = (vistos.get(issue.code) ?? 0) + 1;
    vistos.set(issue.code, n);
    if (n <= config.maxPerCode) {
      violations.push(toViolation(issue, config));
    } else {
      cortados.set(issue.code, (cortados.get(issue.code) ?? 0) + 1);
    }
  }

  if (cortados.size > 0) {
    // Ordenado por volume: o codigo que mais inundou o laudo vem primeiro, e
    // `Map` sozinho daria ordem de insercao, que nao e determinista o
    // suficiente para o invariante 1 quando a entrada muda de ordem.
    const porVolume = [...cortados.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    violations.push({
      kind: "SCHEMA",
      code: TRUNCATED_CODE,
      severity: "warn",
      got: {
        message: `${porVolume.reduce((s, [, n]) => s + n, 0)} violacoes omitidas alem do teto de ${config.maxPerCode} por codigo.`,
        omitidas: Object.fromEntries(porVolume),
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

/**
 * Invariante 4: toda violacao aponta um lugar. O validator da um JSON pointer
 * quando ja chegou no conteudo e um byte offset quando o problema e do
 * container GLB; os dois viram `nodePath`, sem inventar pointer que nao existe.
 */
function locate(issue: GltfIssue): { nodePath?: string } {
  if (issue.pointer !== undefined && issue.pointer !== "") {
    return { nodePath: issue.pointer };
  }
  if (issue.offset !== undefined) {
    return { nodePath: `offset:${issue.offset}` };
  }
  return {};
}

/**
 * So a severidade Error da Khronos vira "error". O que reprova o asset nao se
 * decide aqui e sim no profile (`failOn`) — invariante 2.
 */
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
    got: {
      severity: "Error",
      message:
        cause instanceof Error
          ? cause.message
          : typeof cause === "string"
            ? cause
            : "O glTF Validator nao conseguiu ler o arquivo.",
    },
    want: {
      conformance: "glTF 2.0",
      failOn: config.failOn,
    },
  };
}

/**
 * Metricas que o proprio validator ja conta. Dimensoes e VRAM ficam de fora
 * ate a camada L3 medir de verdade — campo ausente e honesto, zero seria
 * mentira.
 */
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
