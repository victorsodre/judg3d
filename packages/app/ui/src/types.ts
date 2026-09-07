export type {
  LayerKind,
  MeshMetrics,
  Severity,
  Verdict,
  Violation,
  JudgeReport,
} from "@judg3d/core";
export type { ProfileSummary } from "../../src/routes/profiles.js";
export type {
  JudgeSuccessBody as JudgeSuccess,
  JudgeErrorBody as JudgeFailure,
} from "../../src/routes/judge.js";
export type JudgeResponse =
  | import("../../src/routes/judge.js").JudgeSuccessBody
  | import("../../src/routes/judge.js").JudgeErrorBody;
