import {
  version as gltfValidatorVersion,
  type GltfValidationInfo,
} from "gltf-validator";

import {
  EMPTY_METRICS,
  readBoundedFile,
  MAX_ASSET_BYTES,
  InfraError,
  LAYER_KINDS,
  assertLayersImplemented,
  enabledLayers,
  sha256Hex,
  type JudgeReport,
  type LayerKind,
  type LoadedProfile,
  type MeshMetrics,
  type Verdict,
  type Violation,
} from "@judg3d/core";

import { runSchemaLayer } from "./layers/l1-schema.js";
import { runProfileLayer } from "./layers/l2-profile.js";

/** Identical asset/profile bytes and engine versions must produce the same verdict. */

export type JudgeInput = {
  /** Original asset bytes. */
  bytes: Uint8Array;
  /** Report URI only; it is never fetched. */
  uri: string;
};

export type JudgeOptions = {
  /** judg3d version included in the report. */
  judg3dVersion: string;
  /** Opt-in timestamp; disabled for deterministic output. */
  timestamp?: boolean;
};

export type JudgeOutcome = {
  verdict: Verdict;
  report: JudgeReport;
};

export async function readAsset(path: string): Promise<JudgeInput> {
  try {
    const bytes = await readBoundedFile(path, MAX_ASSET_BYTES);
    return { bytes: new Uint8Array(bytes), uri: path };
  } catch (cause) {
    throw new InfraError(
      `Could not read asset: ${path}`,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}

/** Compose enabled layers; unsupported configuration is an infrastructure failure. */
export async function judge(
  input: JudgeInput,
  loaded: LoadedProfile,
  options: JudgeOptions,
): Promise<JudgeOutcome> {
  const { profile } = loaded;
  assertLayersImplemented(profile);

  const layers = enabledLayers(profile);
  const violations: Violation[] = [];
  let metrics: MeshMetrics = { ...EMPTY_METRICS };
  let info: GltfValidationInfo | undefined;
  let pass = true;

  if (profile.layers.schema.enabled) {
    const result = await runSchemaLayer(
      input.bytes,
      input.uri,
      profile.layers.schema,
    );
    append(violations, result.violations);
    metrics = result.metrics;
    info = result.report?.info;
    pass = result.pass;
  }

  if (profile.layers.profile.enabled) {
    const result = runProfileLayer(info, metrics, profile.layers.profile);
    append(violations, result.violations);
    metrics = result.metrics;
    pass =
      pass &&
      !result.violations.some(
        (violation) =>
          violation.severity === "error" ||
          profile.layers.profile.failOn === "warn",
      );
  }

  const verdict: Verdict = {
    pass,
    violations,
    // Renders are reserved for the VISUAL layer.
    views: [],
    metrics,
  };

  return {
    verdict,
    report: buildReport(input, loaded, layers, verdict, options),
  };
}

/** Append iteratively: large validator reports can exceed the argument limit of push(...items). */
export function append<T>(target: T[], source: readonly T[]): void {
  for (const item of source) {
    target.push(item);
  }
}

function buildReport(
  input: JudgeInput,
  loaded: LoadedProfile,
  layers: LayerKind[],
  verdict: Verdict,
  options: JudgeOptions,
): JudgeReport {
  return {
    judg3dVersion: options.judg3dVersion,
    asset: {
      uri: input.uri,
      sha256: sha256Hex(input.bytes),
      bytes: input.bytes.byteLength,
    },
    profile: {
      id: loaded.profile.id,
      version: loaded.profile.version,
      sha256: loaded.sha256,
    },
    engine: {
      gltfValidator: gltfValidatorVersion(),
      node: process.version,
      layers,
    },
    coverage: {
      ran: layers,
      // Explicit coverage prevents unperformed checks from being interpreted as successful checks.

      skipped: LAYER_KINDS.filter((kind) => !layers.includes(kind)),
    },
    ...(options.timestamp === true
      ? { generatedAt: new Date().toISOString() }
      : {}),
    verdict,
  };
}
