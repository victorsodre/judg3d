export {
  append,
  judge,
  readAsset,
  type JudgeInput,
  type JudgeOptions,
  type JudgeOutcome,
} from "./judge.js";

export {
  runSchemaLayer,
  UNPARSEABLE_CODE,
  TRUNCATED_CODE,
  capIssuesPerCode,
  capIssuesPerCode as aplicarTetoPorCodigo,
  type SchemaLayerResult,
} from "./layers/l1-schema.js";

export {
  runProfileLayer,
  EXTERNAL_RESOURCE_CODE,
  METRICS_UNAVAILABLE_CODE,
  type ProfileLayerResult,
} from "./layers/l2-profile.js";

export { engineVersions } from "./engine.js";

export { judgeIsolated } from "./isolated.js";
