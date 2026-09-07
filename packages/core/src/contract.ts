/** The product contract follows the spec; provenance belongs in report.ts. */

/** Pixel bounds in a rendered view. */
export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Canonical layer order. */
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
  /** Stable, actionable diagnostic code, such as MATERIALS_OVER_BUDGET. */
  code: string;
  severity: Severity;
  /** glTF JSON pointer or a container byte offset. */
  nodePath?: string;
  view?: number;
  bbox2d?: Box;
  got: unknown;
  want: unknown;
};

/** Fixed-camera renders are reserved for the VISUAL layer. */
export type AnnotatedRender = {
  /** Camera index in the render rig. */
  view: number;
  /** PNG path relative to the report. */
  path: string;
  width: number;
  height: number;
  /** View-specific violations with pixel bounds. */
  annotations: Violation[];
};

/** Uncomputed optional metrics remain absent; zero would imply a measurement. */
export type MeshMetrics = {
  /** Total triangles across all primitives. */
  triangles: number;
  /** Total vertices across all primitives. */
  vertices: number;
  materials: number;
  drawCalls: number;
  /** Bounding box dimensions in asset units; reserved for GEOMETRY. */
  dimensions?: { x: number; y: number; z: number };
  /** Estimated geometry and texture VRAM; reserved for GEOMETRY. */
  vramEstimateBytes?: number;
  /** Texture measurements from PROFILE. Material count alone does not measure image content; see docs/calibracao-tumbler.md. */
  textures?: { count: number; maxSize: number };
};

export type Verdict = {
  pass: boolean;
  violations: Violation[];
  views: AnnotatedRender[];
  metrics: MeshMetrics;
};

/** Fallback for assets that cannot be measured. The corresponding diagnostic must explain the failure. */
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
