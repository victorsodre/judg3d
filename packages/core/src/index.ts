export {
  LAYER_KINDS,
  EMPTY_METRICS,
  countBySeverity,
  type AnnotatedRender,
  type Box,
  type LayerKind,
  type MeshMetrics,
  type Severity,
  type Verdict,
  type Violation,
} from "./contract.js";

export { InfraError, isInfraError } from "./errors.js";

export {
  EXIT_FAIL,
  EXIT_INFRA,
  EXIT_PASS,
  type ExitCode,
} from "./exit-codes.js";

export { sha256Hex, shortHash } from "./hash.js";

export {
  IMPLEMENTED_LAYERS,
  LAYER_KEY_TO_KIND,
  assertLayersImplemented,
  enabledLayers,
  failOnSchema,
  loadProfile,
  parseProfile,
  profileSchema,
  reportLevelSchema,
  type Budgets,
  type FailOn,
  type LayerKey,
  type LoadedProfile,
  type Profile,
  type ProfileLayerConfig,
  type ReportLevel,
  type SchemaLayerConfig,
} from "./profile.js";

export { serializeReport, type JudgeReport } from "./report.js";
