import { readFile } from "node:fs/promises";
import {
  version as gltfValidatorVersion,
  type GltfValidationInfo,
} from "gltf-validator";

import {
  EMPTY_METRICS,
  InfraError,
  assertLayersImplemented,
  enabledLayers,
  sha256Hex,
  type FailOn,
  type JudgeReport,
  type LayerKind,
  type LoadedProfile,
  type MeshMetrics,
  type Profile,
  type Verdict,
  type Violation,
} from "@judg3d/core";

import { runSchemaLayer } from "./layers/l1-schema.js";
import { runProfileLayer } from "./layers/l2-profile.js";

/**
 * `Verdict = judge(asset, profile)` — funcao pura no que importa: os mesmos
 * bytes com o mesmo profile e o mesmo engine sempre dao o mesmo veredito.
 */

export type JudgeInput = {
  /** Bytes do asset. */
  bytes: Uint8Array;
  /** Caminho ou URL, so para o relatorio e para as mensagens do validator. */
  uri: string;
};

export type JudgeOptions = {
  /** Versao do judg3d que assina o relatorio. */
  judg3dVersion: string;
  /** Inclui `generatedAt`. Fora por padrao: relatorio sem timestamp e byte-deterministico. */
  timestamp?: boolean;
};

export type JudgeOutcome = {
  verdict: Verdict;
  report: JudgeReport;
};

export async function readAsset(path: string): Promise<JudgeInput> {
  try {
    const bytes = await readFile(path);
    return { bytes: new Uint8Array(bytes), uri: path };
  } catch (cause) {
    throw new InfraError(
      `Nao consegui ler o asset: ${path}`,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}

/**
 * Roda as camadas ligadas no profile e compoe o Verdict.
 *
 * Lanca `InfraError` — que o CLI traduz em exit 2 — quando o profile pede uma
 * camada que esta versao nao implementa. Um PASS que na verdade significa
 * "essa checagem nem rodou" e o unico resultado que nao pode existir.
 */
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

  if (profile.layers.schema.enabled) {
    const result = await runSchemaLayer(
      input.bytes,
      input.uri,
      profile.layers.schema,
    );
    violations.push(...result.violations);
    metrics = result.metrics;
    info = result.report?.info;
  }

  if (profile.layers.profile.enabled) {
    const result = runProfileLayer(info, metrics, profile.layers.profile);
    violations.push(...result.violations);
    metrics = result.metrics;
  }

  const verdict: Verdict = {
    pass: computePass(violations, profile),
    violations,
    // Views entram com a camada VISUAL (L4), na sessao do rasterizador.
    views: [],
    metrics,
  };

  return {
    verdict,
    report: buildReport(input, loaded, layers, verdict, options),
  };
}

/**
 * Invariante 2: quem decide o que reprova e o profile. `failOn: "error"` deixa
 * avisos passarem; `failOn: "warn"` reprova neles tambem.
 *
 * O `failOn` e **por camada**, e cada violacao carrega o `kind` de quem a
 * emitiu. Um profile que tolera aviso de schema num asset de terceiro nao
 * deveria, por isso, tolerar aviso de orcamento — sao decisoes diferentes e
 * amarra-las esconderia uma delas.
 */
function computePass(violations: readonly Violation[], profile: Profile): boolean {
  // Espalhado condicionalmente, e nao com `undefined`: sob
  // `exactOptionalPropertyTypes` a chave ausente e a chave com valor undefined
  // sao coisas diferentes, e aqui a diferenca e real — camada desligada nao tem
  // failOn nenhum.
  const failOnByKind: Partial<Record<LayerKind, FailOn>> = {
    SCHEMA: profile.layers.schema.failOn,
    ...(profile.layers.profile.enabled
      ? { PROFILE: profile.layers.profile.failOn }
      : {}),
  };

  return !violations.some((violation) => {
    const failOn = failOnByKind[violation.kind] ?? "error";
    return failOn === "warn" || violation.severity === "error";
  });
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
    ...(options.timestamp === true
      ? { generatedAt: new Date().toISOString() }
      : {}),
    verdict,
  };
}
