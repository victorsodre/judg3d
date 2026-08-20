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
  const violations = report.issues.messages
    .filter((issue) => issue.severity <= ceiling)
    .map((issue) => toViolation(issue, config));

  return {
    violations,
    metrics: toMetrics(report.info),
    report,
  };
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
