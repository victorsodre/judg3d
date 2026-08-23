import type { GltfResource, GltfValidationInfo } from "gltf-validator";

import type {
  MeshMetrics,
  ProfileLayerConfig,
  Severity,
  Violation,
} from "@judg3d/core";

/**
 * L2 PROFILE — o asset cabe no orcamento e e autocontido?
 *
 * Como a L1, esta camada nao reimplementa nada: le o `info` que o validator da
 * Khronos ja produziu e aplica os limites que vieram do profile. A diferenca
 * e o que ela julga — a L1 pergunta se o arquivo e valido, a L2 pergunta se ele
 * e utilizavel.
 *
 * A distincao nao e teorica. Numa calibracao de 78 rodadas contra um pipeline
 * de autoria por agente, a L1 devolveu `exit 0` em todas as execucoes e o unico
 * defeito que um portao automatico pegou foi orcamento estourado — 35 materiais
 * contra teto de 20, enquanto os triangulos estavam em 0,7% do limite. Aquele
 * portao vivia fora do judg3d. Esta camada o traz para dentro.
 */

/**
 * `storage` que mantem o recurso dentro do arquivo. Valores confirmados
 * empiricamente contra o validator 2.0.0-dev.3.10, nao lidos da documentacao:
 * `glb` (chunk binario), `buffer-view` (imagem embutida) e `data-uri` (base64).
 * Qualquer outro — `external` — aponta para fora.
 */
const SELF_CONTAINED_STORAGE: ReadonlySet<string> = new Set([
  "glb",
  "buffer-view",
  "data-uri",
]);

/**
 * O asset nao pode ser medido, e a camada foi pedida. Nunca e silencio: um
 * PASS que significa "essa checagem nem rodou" e o unico resultado que a spec
 * proibe. Na pratica a L1 ja terra reprovado — `info` some quando
 * `asset.version` e invalido — mas depender disso seria depender de outra
 * camada estar ligada.
 */
export const METRICS_UNAVAILABLE_CODE = "METRICS_UNAVAILABLE";

export const EXTERNAL_RESOURCE_CODE = "EXTERNAL_RESOURCE";

export type ProfileLayerResult = {
  violations: Violation[];
  /** Metricas da L1 acrescidas do que a L2 consegue medir. */
  metrics: MeshMetrics;
};

/**
 * Severidade de uma violacao desta camada. `error` por padrao: o silencio tem
 * que ser pedido, nunca herdado.
 *
 * `METRICS_UNAVAILABLE` nao passa por aqui de proposito — ele nao e um juizo
 * sobre o asset, e sim o aviso de que nenhum juizo foi feito, e rebaixa-lo a
 * aviso reconstruiria o falso PASS que a spec proibe.
 */
function severityOf(code: string, config: ProfileLayerConfig): Severity {
  return config.severityByCode[code] ?? "error";
}

/** Uso como fracao do teto, com duas casas — `0.891` em vez de `0.8908...`. */
function fracao(rule: BudgetRule): number | undefined {
  if (rule.max === null || rule.max === 0) {
    return undefined;
  }
  return Math.round((rule.value / rule.max) * 1000) / 1000;
}

/** Um limite do profile e a metrica correspondente. */
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
          code: METRICS_UNAVAILABLE_CODE,
          severity: "error",
          got: {
            message:
              "O validator nao produziu metricas para este asset, entao o orcamento nao pode ser conferido.",
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
    ...checkBudgets(enriched, textures, config),
    ...checkSelfContained(info.resources, config),
  ];

  return { violations, metrics: enriched };
}

/**
 * Resolucao de textura e o primeiro atributo de *conteudo* de material que da
 * para medir sem abrir o JSON do glTF. A calibracao registrou que contar
 * materiais nao diz nada sobre o que ha dentro deles.
 *
 * Ausente — e nao zero — quando o asset nao tem imagem: zero seria mentira.
 */
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
    if (image === undefined) {
      continue;
    }
    count += 1;
    maxSize = Math.max(maxSize, image.width ?? 0, image.height ?? 0);
  }

  return count === 0 ? undefined : { count, maxSize };
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
        code: rule.code,
        severity: severityOf(rule.code, config),
        got: { metric: rule.metric, value: rule.value, uso: fracao(rule) },
        want: { metric: rule.metric, max: rule.max },
      });
      continue;
    }
    // Dentro do teto, mas perto dele. Nao e defeito do asset — e a informacao
    // que separa "cabe" de "cabe, e a proxima peca nao cabe".
    if (budgets.nearLimit > 0 && rule.max > 0) {
      const uso = rule.value / rule.max;
      if (uso >= budgets.nearLimit) {
        violations.push({
          kind: "PROFILE",
          code: `${rule.code.replace("_OVER_BUDGET", "")}_NEAR_BUDGET`,
          severity: "warn",
          got: { metric: rule.metric, value: rule.value, uso: fracao(rule) },
          want: { metric: rule.metric, max: rule.max, nearLimit: budgets.nearLimit },
        });
      }
    }
  }

  return violations;
}

/**
 * Recurso que mora fora do container. O validator nao reporta isso como
 * problema — e nao e, pelo padrao — mas um asset assim funciona na maquina de
 * quem exportou e quebra em qualquer outra. E a classe de defeito silencioso
 * que um juiz de aceitacao existe para pegar, e a informacao ja esta no
 * relatorio: custa uma comparacao de string.
 */
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
