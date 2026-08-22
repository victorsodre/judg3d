/**
 * Tipos do envelope HTTP. **Reexporta o contrato, nao o copia.**
 *
 * A versao anterior era um espelho escrito a mao, com a justificativa de nao
 * arrastar `node:` para o browser. A justificativa estava certa e a solucao,
 * errada: `import type` e apagado na compilacao e nao gera import nenhum em
 * runtime, entao o espelho so servia para divergir — e divergiu, ficando sem
 * `MeshMetrics.textures` no dia em que a L2 passou a medi-lo.
 *
 * Valor (nao tipo) vem de `@judg3d/core/present`, o unico modulo do core sem
 * `node:`. Importar valor do root puxaria `zod`, `node:fs` e `node:crypto`.
 */
export type {
  LayerKind,
  MeshMetrics,
  Severity,
  Verdict,
  Violation,
  JudgeReport,
} from "@judg3d/core";

export type ProfileSummary = {
  id: string;
  version: string;
  filename: string;
  path: string;
};

export type JudgeSuccess = {
  ok: true;
  exitHint: 0 | 1;
  report: import("@judg3d/core").JudgeReport;
  serialized: string;
};

export type JudgeFailure = {
  ok: false;
  exitHint: 2;
  error: "infra" | "bad_request";
  message: string;
  detail?: string;
};

export type JudgeResponse = JudgeSuccess | JudgeFailure;
