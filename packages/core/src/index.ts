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

export {
  compareExitCode,
  compareReports,
  coverageCompareNote,
  serializeCompare,
  type CompareDocument,
  type CompareMetrics,
  type CompareOptions,
  type MetricDelta,
  type ViolationCodeDiff,
} from "./compare.js";

export { InfraError, isInfraError } from "./errors.js";

export {
  EXIT_FAIL,
  EXIT_INFRA,
  EXIT_PASS,
  type ExitCode,
} from "./exit-codes.js";

export { sha256Hex } from "./hash.js";

export {
  formatBytes,
  formatSignedDelta,
  isCompareDocument,
  messageOf,
  shortHash,
  violationDetail,
} from "./present.js";

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

export {
  readBoundedFile,
  MAX_ASSET_BYTES,
  MAX_PROFILE_BYTES,
} from "./files.js";
