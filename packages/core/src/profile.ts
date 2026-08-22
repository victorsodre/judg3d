import { readFile } from "node:fs/promises";
import { z } from "zod";

import type { LayerKind } from "./contract.js";
import { InfraError } from "./errors.js";
import { sha256Hex } from "./hash.js";

/**
 * Profile-as-code. Invariante 2 da spec: toda tolerancia mora aqui, nunca
 * hardcoded no juiz. O schema e estrito de proposito — chave desconhecida e
 * erro de infra, nao silencio: um typo em `ignoredIssues` viraria um asset
 * ruim aprovado sem ninguem perceber.
 */

/** Severidade minima que reprova o asset. */
export const failOnSchema = z.enum(["error", "warn"]);

/** Severidade minima que entra no relatorio como Violation. */
export const reportLevelSchema = z.enum(["error", "warn", "info", "hint"]);

export type FailOn = z.infer<typeof failOnSchema>;
export type ReportLevel = z.infer<typeof reportLevelSchema>;

/**
 * L1 SCHEMA. `ignoredIssues`, `severityOverrides` e `maxIssues` sao repassados
 * direto ao glTF Validator da Khronos; `failOn` e `report` sao do judg3d.
 */
const schemaLayerSchema = z.strictObject({
  enabled: z.boolean(),
  failOn: failOnSchema.default("error"),
  report: reportLevelSchema.default("warn"),
  ignoredIssues: z.array(z.string()).default([]),
  /** Codigo do validator -> severidade Khronos (0=Error 1=Warning 2=Info 3=Hint). */
  severityOverrides: z.record(z.string(), z.int().min(0).max(3)).default({}),
  /** 0 = ilimitado. */
  maxIssues: z.int().min(0).default(0),
});

/**
 * Orcamento do asset. `null` desliga o limite — e a diferenca entre "sem teto"
 * e "teto zero" precisa ser explicita, senao um campo esquecido reprova tudo.
 */
const budgetSchema = z.strictObject({
  maxTriangles: z.int().min(0).nullable().default(null),
  maxVertices: z.int().min(0).nullable().default(null),
  maxMaterials: z.int().min(0).nullable().default(null),
  maxDrawCalls: z.int().min(0).nullable().default(null),
  /** Maior lado, em pixels, de qualquer imagem do asset. */
  maxTextureSize: z.int().min(0).nullable().default(null),
});

const NO_BUDGET = {
  maxTriangles: null,
  maxVertices: null,
  maxMaterials: null,
  maxDrawCalls: null,
  maxTextureSize: null,
} as const;

/**
 * L2 PROFILE. Orcamento e autocontencao — as duas checagens que a inspecao
 * estatica do relatorio do validator ja permite, sem abrir o glTF.
 */
const profileLayerSchema = z.strictObject({
  enabled: z.boolean(),
  failOn: failOnSchema.default("error"),
  budgets: budgetSchema.default(NO_BUDGET),
  /**
   * Recurso fora do container reprova. Um GLB com URI externa funciona na
   * maquina de quem exportou e quebra em qualquer outra — e o validator nao
   * trata isso como erro, porque nao e.
   */
  requireSelfContained: z.boolean().default(true),
});

/**
 * L3-L5 ainda nao existem. Ficam declaradas para que o formato do profile nao
 * mude quando entrarem, e para que habilitar uma delas hoje de erro de infra
 * em vez de ser ignorado em silencio.
 */
const placeholderLayerSchema = z.strictObject({
  enabled: z.boolean(),
});

export const profileSchema = z.strictObject({
  id: z.string().min(1),
  version: z.string().min(1),
  /** Versao do formato do arquivo, para migracao futura. */
  profileFormat: z.literal(1),
  /** Audit Profile da Khronos a herdar. Ainda nao implementado. */
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

/** Chave do profile -> camada do contrato. */
export const LAYER_KEY_TO_KIND: Readonly<Record<LayerKey, LayerKind>> = {
  schema: "SCHEMA",
  profile: "PROFILE",
  geometry: "GEOMETRY",
  visual: "VISUAL",
  semantic: "SEMANTIC",
};

/** O que o judg3d sabe julgar hoje. Cresce uma camada por sessao. */
export const IMPLEMENTED_LAYERS: ReadonlySet<LayerKind> = new Set<LayerKind>([
  "SCHEMA",
  "PROFILE",
]);

export type LoadedProfile = {
  profile: Profile;
  /** sha256 do arquivo cru, para o envelope do relatorio. */
  sha256: string;
  /** Caminho como o usuario passou, para mensagens legiveis. */
  source: string;
};

export function parseProfile(raw: string, source: string): Profile {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new InfraError(
      `Profile invalido: ${source} nao e JSON valido.`,
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  const result = profileSchema.safeParse(json);
  if (!result.success) {
    throw new InfraError(
      `Profile invalido: ${source}`,
      z.prettifyError(result.error),
    );
  }
  return result.data;
}

export async function loadProfile(path: string): Promise<LoadedProfile> {
  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch (cause) {
    throw new InfraError(
      `Nao consegui ler o profile: ${path}`,
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  return {
    profile: parseProfile(bytes.toString("utf8"), path),
    sha256: sha256Hex(bytes),
    source: path,
  };
}

/** Camadas ligadas no profile, na ordem do contrato. */
export function enabledLayers(profile: Profile): LayerKind[] {
  return (Object.keys(profile.layers) as LayerKey[])
    .filter((key) => profile.layers[key].enabled)
    .map((key) => LAYER_KEY_TO_KIND[key]);
}

/**
 * Invariante 3: uma camada pedida e nao implementada e erro de infra. O pior
 * resultado possivel seria um PASS que so significa "essa checagem nem rodou".
 */
export function assertLayersImplemented(profile: Profile): void {
  const missing = enabledLayers(profile).filter(
    (kind) => !IMPLEMENTED_LAYERS.has(kind),
  );
  if (missing.length > 0) {
    throw new InfraError(
      `Profile "${profile.id}" habilita camada(s) ainda nao implementada(s): ${missing.join(", ")}.`,
      `Implementadas nesta versao: ${[...IMPLEMENTED_LAYERS].join(", ")}. ` +
        "Aprovar um asset sem rodar a camada pedida seria um falso PASS.",
    );
  }
}
