import { readBoundedFile, MAX_PROFILE_BYTES } from "./files.js";
import { z } from "zod";

import type { LayerKind } from "./contract.js";
import { InfraError } from "./errors.js";
import { sha256Hex } from "./hash.js";

/** Acceptance thresholds belong in the profile. Strict schemas reject unknown configuration keys as infrastructure failures. */

/** Minimum severity that fails the asset. */
export const failOnSchema = z.enum(["error", "warn"]);

/** Minimum severity included in the report. */
export const reportLevelSchema = z.enum(["error", "warn", "info", "hint"]);

export type FailOn = z.infer<typeof failOnSchema>;
export type ReportLevel = z.infer<typeof reportLevelSchema>;

/** Khronos options forwarded to the validator, independent of judg3d failOn/report. */
const schemaLayerSchema = z.strictObject({
  enabled: z.boolean(),
  failOn: failOnSchema.default("error"),
  report: reportLevelSchema.default("warn"),
  ignoredIssues: z.array(z.string()).default([]),
  /** Khronos severity overrides: 0 Error, 1 Warning, 2 Information, 3 Hint. */
  severityOverrides: z.record(z.string(), z.int().min(0).max(3)).default({}),
  /** Zero means unlimited. */
  maxIssues: z.int().min(0).default(0),
  /** Post-validation cap per code preserves diagnostic diversity and declares omitted occurrences. Unlike maxIssues, it does not interrupt validation. */
  maxPerCode: z.int().min(0).default(0),
});

/** Null means unlimited; zero is a strict zero budget. */
const budgetSchema = z.strictObject({
  maxTriangles: z.int().min(0).nullable().default(null),
  maxVertices: z.int().min(0).nullable().default(null),
  maxMaterials: z.int().min(0).nullable().default(null),
  maxDrawCalls: z.int().min(0).nullable().default(null),
  /** Largest permitted image dimension in pixels. */
  maxTextureSize: z.int().min(0).nullable().default(null),
  /** Budget usage fraction that triggers a warning; zero disables early warnings. */
  nearLimit: z.number().min(0).max(1).default(0),
});

const NO_BUDGET = {
  maxTriangles: null,
  maxVertices: null,
  maxMaterials: null,
  maxDrawCalls: null,
  maxTextureSize: null,
  nearLimit: 0,
} as const;

/** PROFILE checks budgets and self-containment using Khronos validation info. */
const profileLayerSchema = z.strictObject({
  enabled: z.boolean(),
  failOn: failOnSchema.default("error"),
  budgets: budgetSchema.default(NO_BUDGET),
  /** Diagnostics default to error unless explicitly downgraded by code. */
  severityByCode: z.record(z.string(), failOnSchema).default({}),
  /** Require every resource to be embedded in the asset. */
  requireSelfContained: z.boolean().default(true),
});

/** Future layers are declared but rejected when enabled until implemented. */
const placeholderLayerSchema = z.strictObject({
  enabled: z.boolean(),
});

export const profileSchema = z.strictObject({
  id: z.string().min(1),
  version: z.string().min(1),
  /** Profile format version. */
  profileFormat: z.literal(1),
  /** Profile inheritance is not implemented. */
  extends: z.string().min(1).nullable(),
  layers: z.strictObject({
    schema: schemaLayerSchema,
    profile: profileLayerSchema,
    geometry: placeholderLayerSchema,
    visual: placeholderLayerSchema,
    semantic: placeholderLayerSchema,
  }),
});

export type Profile = z.infer<typeof profileSchema>;
export type SchemaLayerConfig = z.infer<typeof schemaLayerSchema>;
export type ProfileLayerConfig = z.infer<typeof profileLayerSchema>;
export type Budgets = z.infer<typeof budgetSchema>;
export type LayerKey = keyof Profile["layers"];

/** Configuration key to contract layer mapping. */
export const LAYER_KEY_TO_KIND: Readonly<Record<LayerKey, LayerKind>> = {
  schema: "SCHEMA",
  profile: "PROFILE",
  geometry: "GEOMETRY",
  visual: "VISUAL",
  semantic: "SEMANTIC",
};

/** Layers implemented by this version. */
export const IMPLEMENTED_LAYERS: ReadonlySet<LayerKind> = new Set<LayerKind>([
  "SCHEMA",
  "PROFILE",
]);

export type LoadedProfile = {
  profile: Profile;
  /** SHA-256 of the original profile bytes. */
  sha256: string;
  /** Original path used in diagnostics. */
  source: string;
};

export function parseProfile(raw: string, source: string): Profile {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new InfraError(
      `Invalid profile: ${source} is not valid JSON.`,
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  const result = profileSchema.safeParse(json);
  if (!result.success) {
    throw new InfraError(
      `Invalid profile: ${source}`,
      z.prettifyError(result.error),
    );
  }
  return result.data;
}

export async function loadProfile(path: string): Promise<LoadedProfile> {
  let bytes: Buffer;
  try {
    bytes = await readBoundedFile(path, MAX_PROFILE_BYTES);
  } catch (cause) {
    throw new InfraError(
      `Could not read profile: ${path}`,
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  return {
    profile: parseProfile(bytes.toString("utf8"), path),
    sha256: sha256Hex(bytes),
    source: path,
  };
}

/** Enabled layers in canonical order. */
export function enabledLayers(profile: Profile): LayerKind[] {
  return (Object.keys(profile.layers) as LayerKey[])
    .filter((key) => profile.layers[key].enabled)
    .map((key) => LAYER_KEY_TO_KIND[key]);
}

/** Reject configurations that cannot be executed; an unperformed check must never produce a false PASS. */
export function assertLayersImplemented(profile: Profile): void {
  if (profile.extends !== null) {
    throw new InfraError(
      "Profile inheritance is not implemented yet. Use extends: null.",
    );
  }
  if (enabledLayers(profile).length === 0) {
    throw new InfraError("The profile must enable at least one layer.");
  }
  if (profile.layers.profile.enabled && !profile.layers.schema.enabled) {
    throw new InfraError("The PROFILE layer requires SCHEMA to be enabled.");
  }
  const missing = enabledLayers(profile).filter(
    (kind) => !IMPLEMENTED_LAYERS.has(kind),
  );
  if (missing.length > 0) {
    throw new InfraError(
      `Profile "${profile.id}" enables unimplemented layer(s): ${missing.join(", ")}.`,
      `Implemented in this version: ${[...IMPLEMENTED_LAYERS].join(", ")}. ` +
        "Approving an asset without running the requested layer would be a false PASS.",
    );
  }
}
