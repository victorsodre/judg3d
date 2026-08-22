/** Tipos do envelope HTTP — espelho do contrato, sem importar Node no browser. */

export type Severity = "error" | "warn";

export type LayerKind =
  | "SCHEMA"
  | "PROFILE"
  | "GEOMETRY"
  | "VISUAL"
  | "SEMANTIC";

export type Violation = {
  kind: LayerKind;
  code: string;
  severity: Severity;
  nodePath?: string;
  view?: number;
  got: unknown;
  want: unknown;
};

export type MeshMetrics = {
  triangles: number;
  vertices: number;
  materials: number;
  drawCalls: number;
  dimensions?: { x: number; y: number; z: number };
  vramEstimateBytes?: number;
};

export type Verdict = {
  pass: boolean;
  violations: Violation[];
  views: unknown[];
  metrics: MeshMetrics;
};

export type JudgeReport = {
  judg3dVersion: string;
  asset: { uri: string; sha256: string; bytes: number };
  profile: { id: string; version: string; sha256: string };
  engine: {
    gltfValidator: string;
    node: string;
    layers: LayerKind[];
  };
  generatedAt?: string;
  verdict: Verdict;
};

export type ProfileSummary = {
  id: string;
  version: string;
  filename: string;
  path: string;
};

export type JudgeSuccess = {
  ok: true;
  exitHint: 0 | 1;
  report: JudgeReport;
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
