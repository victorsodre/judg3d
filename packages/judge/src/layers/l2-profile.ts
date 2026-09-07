import type { GltfResource, GltfValidationInfo } from "gltf-validator";

import type {
  MeshMetrics,
  ProfileLayerConfig,
  Severity,
  Violation,
} from "@judg3d/core";

/** PROFILE applies configured budgets and self-containment rules to Khronos info without reimplementing a glTF parser. */

/** Embedded storage values verified against validator 2.0.0-dev.3.10: glb, buffer-view and data-uri. Other values identify external resources. */
const SELF_CONTAINED_STORAGE: ReadonlySet<string> = new Set([
  "glb",
  "buffer-view",
  "data-uri",
]);

/** An enabled check with unavailable measurements must not silently pass. */
export const METRICS_UNAVAILABLE_CODE = "METRICS_UNAVAILABLE";

export const EXTERNAL_RESOURCE_CODE = "EXTERNAL_RESOURCE";

export type ProfileLayerResult = {
  violations: Violation[];
  /** SCHEMA metrics enriched with measurements available to PROFILE. */
  metrics: MeshMetrics;
};

/** Budget diagnostics default to error. Missing measurements cannot be downgraded because that would allow an unperformed check to pass. */
function severityOf(code: string, config: ProfileLayerConfig): Severity {
  return config.severityByCode[code] ?? "error";
}

/** Budget usage fraction rounded to three decimal places. */
function usageRatio(rule: BudgetRule): number | undefined {
  if (rule.max === null || rule.max === 0) {
    return undefined;
  }
  return Math.round((rule.value / rule.max) * 1000) / 1000;
}

/** Profile budget and its corresponding measured value. */
type BudgetRule = {
  code: string;
  metric: string;
  value: number;
  max: number | null;
};

export function runProfileLayer(
  info: GltfValidationInfo | undefined,
  metrics: MeshMetrics,
  config: ProfileLayerConfig,
): ProfileLayerResult {
  if (info === undefined) {
    return {
      violations: [
        {
          kind: "PROFILE",
          nodePath: "",
          code: METRICS_UNAVAILABLE_CODE,
          severity: "error",
          got: {
            message:
              "The validator did not produce metrics for this asset, so its budgets cannot be checked.",
          },
          want: { measurable: true },
        },
      ],
      metrics,
    };
  }

  const textures = summarizeTextures(info.resources);
  const enriched: MeshMetrics =
    textures === undefined ? metrics : { ...metrics, textures };

  const violations: Violation[] = [
    ...checkTextureMeasurements(info.resources, config),
    ...checkBudgets(enriched, textures, config),
    ...checkSelfContained(info.resources, config),
  ];

  return { violations, metrics: enriched };
}

/** Texture metrics remain absent when there are no images or measurements are unavailable. */
function summarizeTextures(
  resources: readonly GltfResource[] | undefined,
): MeshMetrics["textures"] {
  if (resources === undefined) {
    return undefined;
  }

  let count = 0;
  let maxSize = 0;
  for (const resource of resources) {
    const image = resource.image;
    if (
      resource.pointer.startsWith("/images/") &&
      (image?.width === undefined || image.height === undefined)
    ) {
      return undefined;
    }
    if (image === undefined) {
      continue;
    }
    count += 1;
    if (image.width === undefined || image.height === undefined)
      return undefined;
    maxSize = Math.max(maxSize, image.width, image.height);
  }

  return count === 0 ? undefined : { count, maxSize };
}

function checkTextureMeasurements(
  resources: readonly GltfResource[] | undefined,
  config: ProfileLayerConfig,
): Violation[] {
  if (config.budgets.maxTextureSize === null) return [];
  return (resources ?? [])
    .filter(
      (resource) =>
        resource.pointer.startsWith("/images/") &&
        (resource.image?.width === undefined ||
          resource.image.height === undefined),
    )
    .map((resource) => ({
      kind: "PROFILE" as const,
      code: "TEXTURE_METRICS_UNAVAILABLE",
      severity: "error" as const,
      nodePath: resource.pointer,
      got: {
        message:
          "This image could not be measured to check its resolution limit.",
      },
      want: { measurable: true, maxTextureSize: config.budgets.maxTextureSize },
    }));
}

function checkBudgets(
  metrics: MeshMetrics,
  textures: MeshMetrics["textures"],
  config: ProfileLayerConfig,
): Violation[] {
  const { budgets } = config;
  const rules: BudgetRule[] = [
    {
      code: "TRIANGLES_OVER_BUDGET",
      metric: "triangles",
      value: metrics.triangles,
      max: budgets.maxTriangles,
    },
    {
      code: "VERTICES_OVER_BUDGET",
      metric: "vertices",
      value: metrics.vertices,
      max: budgets.maxVertices,
    },
    {
      code: "MATERIALS_OVER_BUDGET",
      metric: "materials",
      value: metrics.materials,
      max: budgets.maxMaterials,
    },
    {
      code: "DRAW_CALLS_OVER_BUDGET",
      metric: "drawCalls",
      value: metrics.drawCalls,
      max: budgets.maxDrawCalls,
    },
  ];

  if (textures !== undefined) {
    rules.push({
      code: "TEXTURE_OVER_BUDGET",
      metric: "maxTextureSize",
      value: textures.maxSize,
      max: budgets.maxTextureSize,
    });
  }

  const violations: Violation[] = [];

  for (const rule of rules) {
    if (rule.max === null) {
      continue;
    }
    if (rule.value > rule.max) {
      violations.push({
        kind: "PROFILE",
        nodePath: "",
        code: rule.code,
        severity: severityOf(rule.code, config),
        got: {
          metric: rule.metric,
          value: rule.value,
          usage: usageRatio(rule),
        },
        want: { metric: rule.metric, max: rule.max },
      });
      continue;
    }
    // Early warning threshold is controlled by the profile.

    if (budgets.nearLimit > 0 && rule.max > 0) {
      const usage = rule.value / rule.max;
      if (usage >= budgets.nearLimit) {
        violations.push({
          kind: "PROFILE",
          nodePath: "",
          code: `${rule.code.replace("_OVER_BUDGET", "")}_NEAR_BUDGET`,
          severity: "warn",
          got: {
            metric: rule.metric,
            value: rule.value,
            usage: usageRatio(rule),
          },
          want: {
            metric: rule.metric,
            max: rule.max,
            nearLimit: budgets.nearLimit,
          },
        });
      }
    }
  }

  return violations;
}

/** External resources are valid glTF, but may fail a profile that requires a portable, self-contained asset. */
function checkSelfContained(
  resources: readonly GltfResource[] | undefined,
  config: ProfileLayerConfig,
): Violation[] {
  if (!config.requireSelfContained || resources === undefined) {
    return [];
  }

  return resources
    .filter(
      (resource) =>
        resource.storage !== undefined &&
        !SELF_CONTAINED_STORAGE.has(resource.storage),
    )
    .map((resource) => ({
      kind: "PROFILE" as const,
      code: EXTERNAL_RESOURCE_CODE,
      severity: severityOf(EXTERNAL_RESOURCE_CODE, config),
      nodePath: resource.pointer,
      got: { storage: resource.storage, uri: resource.uri },
      want: { storage: [...SELF_CONTAINED_STORAGE] },
    }));
}
