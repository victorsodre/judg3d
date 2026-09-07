import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { loadProfile, parseProfile } from "@judg3d/core";
import type { LoadedProfile, MeshMetrics } from "@judg3d/core";
import type { GltfValidationInfo } from "gltf-validator";

import {
  judge,
  readAsset,
  runProfileLayer,
  EXTERNAL_RESOURCE_CODE,
  METRICS_UNAVAILABLE_CODE,
} from "../src/index.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const fixture = (name: string): string => `${repoRoot}fixtures/${name}`;

const OPTIONS = { judg3dVersion: "0.0.0-test" };

/** Profile com a L2 ligada e o orcamento que o teste quiser. */
function withBudgets(
  budgets: Record<string, number | null>,
  extra: Record<string, unknown> = {},
): LoadedProfile {
  const base = {
    id: "derivado-l2",
    version: "0.0.1",
    profileFormat: 1,
    extends: null,
    layers: {
      schema: {
        enabled: true,
        failOn: "error",
        report: "warn",
        ignoredIssues: [],
        severityOverrides: {},
        maxIssues: 0,
      },
      profile: { enabled: true, budgets, ...extra },
      geometry: { enabled: false },
      visual: { enabled: false },
      semantic: { enabled: false },
    },
  };
  return {
    profile: parseProfile(JSON.stringify(base), "derivado-l2.json"),
    sha256: "0".repeat(64),
    source: "derivado-l2.json",
  };
}

const L1_METRICS: MeshMetrics = {
  triangles: 12,
  vertices: 24,
  materials: 1,
  drawCalls: 1,
};

/** `info` minimo. So os campos que a L2 le. */
function info(patch: Partial<GltfValidationInfo> = {}): GltfValidationInfo {
  return {
    version: "2.0",
    animationCount: 0,
    materialCount: 1,
    hasMorphTargets: false,
    hasSkins: false,
    hasTextures: false,
    hasDefaultScene: true,
    drawCallCount: 1,
    totalVertexCount: 24,
    totalTriangleCount: 12,
    maxUVs: 0,
    maxInfluences: 0,
    maxAttributes: 3,
    ...patch,
  };
}

describe("L2 PROFILE nos fixtures reais", () => {
  it("aprova valido.glb dentro do orcamento do agent-loop", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("valido.glb")),
      await loadProfile(`${repoRoot}profiles/agent-loop.json`),
      OPTIONS,
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.violations).toEqual([]);
  });

  it("mede a textura de valido-textura.glb — 256 px, uma imagem", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("valido-textura.glb")),
      await loadProfile(`${repoRoot}profiles/agent-loop.json`),
      OPTIONS,
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.metrics.textures).toEqual({ count: 1, maxSize: 256 });
  });

  it("nao inventa metrica de textura em asset sem imagem", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("valido.glb")),
      await loadProfile(`${repoRoot}profiles/agent-loop.json`),
      OPTIONS,
    );
    expect(verdict.metrics.textures).toBeUndefined();
  });

  it("reprova quando o orcamento de triangulos e menor que o asset", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("valido.glb")),
      withBudgets({ maxTriangles: 4 }),
      OPTIONS,
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.violations).toContainEqual({
      kind: "PROFILE",
      nodePath: "",
      code: "TRIANGLES_OVER_BUDGET",
      severity: "error",
      // `usage` entrou com o nearLimit: 12/4 = 3,0, ou seja 300% do teto.
      // "value 12, max 4" e "300% do teto" nao custam o mesmo para quem le.
      got: { metric: "triangles", value: 12, usage: 3 },
      want: { metric: "triangles", max: 4 },
    });
  });

  it("reprova a textura acima do teto, apontando a imagem", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("valido-textura.glb")),
      withBudgets({ maxTextureSize: 128 }),
      OPTIONS,
    );
    expect(verdict.pass).toBe(false);
    const violation = verdict.violations.find(
      (v) => v.code === "TEXTURE_OVER_BUDGET",
    );
    expect(violation?.got).toEqual({
      metric: "maxTextureSize",
      value: 256,
      usage: 2,
    });
  });
});

describe("L2 PROFILE — orcamento", () => {
  it("nao reprova nada com todos os limites nulos", () => {
    const { violations } = runProfileLayer(info(), L1_METRICS, {
      enabled: true,
      failOn: "error",
      budgets: {
        maxTriangles: null,
        maxVertices: null,
        maxMaterials: null,
        maxDrawCalls: null,
        maxTextureSize: null,
        nearLimit: 0,
      },
      severityByCode: {},
      requireSelfContained: true,
    });
    expect(violations).toEqual([]);
  });

  it("distingue teto zero de sem teto", () => {
    const { violations } = runProfileLayer(info(), L1_METRICS, {
      enabled: true,
      failOn: "error",
      budgets: {
        maxTriangles: 0,
        maxVertices: null,
        maxMaterials: null,
        maxDrawCalls: null,
        maxTextureSize: null,
        nearLimit: 0,
      },
      severityByCode: {},
      requireSelfContained: true,
    });
    expect(violations.map((v) => v.code)).toEqual(["TRIANGLES_OVER_BUDGET"]);
  });

  it("o caso que motivou a camada: 35 materiais contra teto de 20", () => {
    const { violations } = runProfileLayer(
      info({ materialCount: 35, drawCallCount: 35, totalTriangleCount: 2472 }),
      { triangles: 2472, vertices: 4024, materials: 35, drawCalls: 35 },
      {
        enabled: true,
        failOn: "error",
        budgets: {
          maxTriangles: 350000,
          maxVertices: null,
          maxMaterials: 20,
          maxDrawCalls: 60,
          maxTextureSize: null,
          nearLimit: 0,
        },
        severityByCode: {},
        requireSelfContained: true,
      },
    );
    // Triangulos em 0,7% do teto e draw calls em 58%: so material estoura.
    expect(violations.map((v) => v.code)).toEqual(["MATERIALS_OVER_BUDGET"]);
    expect(violations[0]?.got).toEqual({
      metric: "materials",
      value: 35,
      usage: 1.75,
    });
  });
});

describe("L2 PROFILE — autocontencao", () => {
  const externo = info({
    resources: [
      { pointer: "/buffers/0", storage: "external", uri: "cena.bin" },
      { pointer: "/images/0", storage: "buffer-view" },
    ],
  });

  it("reprova recurso skipped do container e aponta o pointer", () => {
    const { violations } = runProfileLayer(externo, L1_METRICS, {
      enabled: true,
      failOn: "error",
      budgets: {
        maxTriangles: null,
        maxVertices: null,
        maxMaterials: null,
        maxDrawCalls: null,
        maxTextureSize: null,
        nearLimit: 0,
      },
      severityByCode: {},
      requireSelfContained: true,
    });
    expect(violations).toEqual([
      {
        kind: "PROFILE",
        code: EXTERNAL_RESOURCE_CODE,
        severity: "error",
        nodePath: "/buffers/0",
        got: { storage: "external", uri: "cena.bin" },
        want: { storage: ["glb", "buffer-view", "data-uri"] },
      },
    ]);
  });

  it("aceita o mesmo asset quando o profile nao exige autocontencao", () => {
    const { violations } = runProfileLayer(externo, L1_METRICS, {
      enabled: true,
      failOn: "error",
      budgets: {
        maxTriangles: null,
        maxVertices: null,
        maxMaterials: null,
        maxDrawCalls: null,
        maxTextureSize: null,
        nearLimit: 0,
      },
      severityByCode: {},
      requireSelfContained: false,
    });
    expect(violations).toEqual([]);
  });
});

describe("L2 PROFILE — o que nao pode acontecer", () => {
  it("imagem não medida não recebe tamanho zero nem passa pelo orçamento", async () => {
    const loaded = withBudgets(
      { maxTextureSize: 2048 },
      { requireSelfContained: false },
    );
    loaded.profile.layers.schema.ignoredIssues = ["IO_ERROR"];
    const asset = {
      asset: { version: "2.0" },
      images: [{ uri: "texture.png" }],
      textures: [{ source: 0 }],
    };
    const { verdict } = await judge(
      {
        bytes: new TextEncoder().encode(JSON.stringify(asset)),
        uri: "external.gltf",
      },
      loaded,
      OPTIONS,
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.metrics.textures).toBeUndefined();
    expect(verdict.violations).toContainEqual(
      expect.objectContaining({
        kind: "PROFILE",
        code: "TEXTURE_METRICS_UNAVAILABLE",
        severity: "error",
        nodePath: "/images/0",
      }),
    );
  });
  it("sem metricas, acusa em vez de aprovar em silencio", () => {
    const { violations } = runProfileLayer(undefined, L1_METRICS, {
      enabled: true,
      failOn: "error",
      budgets: {
        maxTriangles: null,
        maxVertices: null,
        maxMaterials: null,
        maxDrawCalls: null,
        maxTextureSize: null,
        nearLimit: 0,
      },
      severityByCode: {},
      requireSelfContained: true,
    });
    expect(violations.map((v) => v.code)).toEqual([METRICS_UNAVAILABLE_CODE]);
    expect(violations[0]?.severity).toBe("error");
  });

  it("o relatorio continua byte-deterministico com a L2 ligada", async () => {
    const asset = await readAsset(fixture("valido-textura.glb"));
    const profile = await loadProfile(`${repoRoot}profiles/agent-loop.json`);
    const a = await judge(asset, profile, OPTIONS);
    const b = await judge(asset, profile, OPTIONS);
    expect(JSON.stringify(a.report)).toBe(JSON.stringify(b.report));
  });
});

describe("L2 PROFILE — severidade decidida pelo profile", () => {
  const config = (severityByCode: Record<string, "error" | "warn">) => ({
    enabled: true,
    failOn: "error" as const,
    budgets: {
      maxTriangles: 4,
      maxVertices: null,
      maxMaterials: null,
      maxDrawCalls: null,
      maxTextureSize: null,
      nearLimit: 0,
    },
    severityByCode,
    requireSelfContained: true,
  });

  it("emite error por padrao — o silencio tem que ser pedido", () => {
    const { violations } = runProfileLayer(info(), L1_METRICS, config({}));
    expect(violations[0]?.severity).toBe("error");
  });

  it("rebaixa para aviso quando o profile pede, e o asset passa", async () => {
    const { violations } = runProfileLayer(
      info(),
      L1_METRICS,
      config({ TRIANGLES_OVER_BUDGET: "warn" }),
    );
    expect(violations[0]?.severity).toBe("warn");

    // O caso de usage real: num loop de autoria, orcamento estourado numa rodada
    // intermediaria e um gap a fechar, nao motivo para parar o trabalho.
    const { verdict } = await judge(
      await readAsset(fixture("valido.glb")),
      withBudgets(
        { maxTriangles: 4 },
        { severityByCode: { TRIANGLES_OVER_BUDGET: "warn" } },
      ),
      OPTIONS,
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.violations.map((v) => v.code)).toEqual([
      "TRIANGLES_OVER_BUDGET",
    ]);
  });

  it("METRICS_UNAVAILABLE nao pode ser rebaixado", () => {
    const { violations } = runProfileLayer(
      undefined,
      L1_METRICS,
      config({ METRICS_UNAVAILABLE: "warn" }),
    );
    expect(violations[0]?.severity).toBe("error");
  });
});

describe("nearLimit — o aviso antes da parede", () => {
  /**
   * Numeros reais do relatorio do round 200 do projeto tumbler-three, que e o
   * que motivou este recurso: o laudo dizia apenas `OK` para
   * `triangulos 311 784 de 350 000`. Sao 89,1%, e a proxima peca nao cabia.
   *
   * `OK` e `OK a 89% do teto` levam a decisoes diferentes.
   */
  const config = (nearLimit: number) => ({
    enabled: true,
    failOn: "error" as const,
    budgets: {
      maxTriangles: 350_000,
      maxVertices: null,
      maxMaterials: 20,
      maxDrawCalls: 60,
      maxTextureSize: 2048,
      nearLimit,
    },
    severityByCode: {},
    requireSelfContained: true,
  });

  const round200 = {
    triangles: 311_784,
    vertices: 317_399,
    materials: 9,
    drawCalls: 46,
  };

  it("com 0, nao avisa nada — o default nao muda comportamento", () => {
    const { violations } = runProfileLayer(
      info({ totalTriangleCount: round200.triangles }),
      round200,
      config(0),
    );
    expect(violations).toEqual([]);
  });

  it("avisa nos 89,1% de triangulos, e so neles", () => {
    const { violations } = runProfileLayer(
      info({ totalTriangleCount: round200.triangles }),
      round200,
      config(0.85),
    );
    // draw calls a 76,7% e materiais a 45% ficam abaixo do limiar: o aviso
    // aponta a metrica que esta perto, nao todas.
    expect(violations.map((v) => v.code)).toEqual(["TRIANGLES_NEAR_BUDGET"]);
    expect(violations[0]?.severity).toBe("warn");
    expect(violations[0]?.got).toEqual({
      metric: "triangles",
      value: 311_784,
      usage: 0.891,
    });
  });

  it("aviso de proximidade nao reprova o asset", () => {
    const { violations } = runProfileLayer(
      info({ totalTriangleCount: round200.triangles }),
      round200,
      config(0.85),
    );
    // Severidade warn com failOn error: o asset passa e o operador fica sabendo.
    expect(violations.every((v) => v.severity === "warn")).toBe(true);
  });

  it("acima do teto vira OVER, nao NEAR — nao os dois", () => {
    const estourado = { ...round200, triangles: 400_000 };
    const { violations } = runProfileLayer(
      info({ totalTriangleCount: 400_000 }),
      estourado,
      config(0.85),
    );
    expect(violations.map((v) => v.code)).toEqual(["TRIANGLES_OVER_BUDGET"]);
    expect(violations[0]?.got).toEqual({
      metric: "triangles",
      value: 400_000,
      usage: 1.143,
    });
  });
});
