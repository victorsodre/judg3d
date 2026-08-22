/**
 * Contrato do judg3d. Os tipos abaixo sao a transcricao direta de
 * `docs/judg3d-spec-v0.md` — nao inventar campos aqui: o que a spec nao
 * decidiu vai no envelope do relatorio (`report.ts`), nao no Verdict.
 */

/** Caixa 2D em pixels dentro de uma view renderizada. */
export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Camadas do juiz, na ordem em que rodam. */
export const LAYER_KINDS = [
  "SCHEMA",
  "PROFILE",
  "GEOMETRY",
  "VISUAL",
  "SEMANTIC",
] as const;

export type LayerKind = (typeof LAYER_KINDS)[number];

export type Severity = "error" | "warn";

export type Violation = {
  kind: LayerKind;
  /** Codigo estavel e acionavel: "UV_OVERLAP", "SCALE_MISMATCH", "VIEW_DIFF"... */
  code: string;
  severity: Severity;
  /** JSON pointer no glTF, ou `offset:<n>` para problemas no container GLB. */
  nodePath?: string;
  view?: number;
  bbox2d?: Box;
  got: unknown;
  want: unknown;
};

/**
 * Render de camera fixa com as violacoes marcadas. Sempre vazio na v0:
 * o rasterizador de software entra na camada VISUAL (L4).
 */
export type AnnotatedRender = {
  /** Indice da camera no rig — enderecavel e comparavel contra baseline. */
  view: number;
  /** Caminho do PNG gravado ao lado do relatorio. */
  path: string;
  width: number;
  height: number;
  /** Violacoes desta view, com bbox2d preenchida. */
  annotations: Violation[];
};

/**
 * Metricas do asset. A spec pede tris, materiais, draw calls, dims e vram.
 * As que ainda nao tem camada que as compute ficam opcionais em vez de
 * receber zero — zero seria mentira, ausente e honesto.
 */
export type MeshMetrics = {
  /** Total de triangulos somando todas as primitivas. */
  triangles: number;
  /** Total de vertices somando todas as primitivas. */
  vertices: number;
  materials: number;
  drawCalls: number;
  /** Dimensoes do bounding box em unidades do asset. Vem com L3. */
  dimensions?: { x: number; y: number; z: number };
  /** Estimativa de VRAM em bytes (geometria + texturas). Vem com L3. */
  vramEstimateBytes?: number;
  /**
   * Texturas do asset. Vem com L2, ausente sem ela.
   *
   * Existe porque `materials` conta materiais e nao diz nada sobre o conteudo
   * deles: numa calibracao de 78 rodadas, a mudanca que mais alterou a imagem
   * produziu duas linhas identicas na serie de metricas. Resolucao e o primeiro
   * atributo de material que da para medir sem abrir o JSON do glTF.
   */
  textures?: { count: number; maxSize: number };
};

export type Verdict = {
  pass: boolean;
  violations: Violation[];
  views: AnnotatedRender[];
  metrics: MeshMetrics;
};

/** Metricas de um asset que nenhuma camada conseguiu medir. */
export const EMPTY_METRICS: MeshMetrics = {
  triangles: 0,
  vertices: 0,
  materials: 0,
  drawCalls: 0,
};

export function countBySeverity(
  violations: readonly Violation[],
): Record<Severity, number> {
  let error = 0;
  let warn = 0;
  for (const violation of violations) {
    if (violation.severity === "error") {
      error += 1;
    } else {
      warn += 1;
    }
  }
  return { error, warn };
}
