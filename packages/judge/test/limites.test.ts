import { describe, expect, it } from "vitest";
import type { GltfIssue } from "gltf-validator";
import type { SchemaLayerConfig } from "@judg3d/core";

import { append, aplicarTetoPorCodigo, TRUNCATED_CODE } from "../src/index.js";

/**
 * Regressao de um asset real: um GLB de producao de 202 mil faces (rip de
 * Batman: Arkham Knight, 35 MB) derrubou o CLI com
 * `RangeError: Maximum call stack size exceeded`.
 *
 * O asset nao entra em `fixtures/`: e grande demais, e de terceiro e de
 * procedencia que o repo nao aceita. Os numeros dele ficam aqui, que e onde
 * uma regressao consegue ser verificada sem ele.
 */
const ISSUES_DO_ASSET_REAL = 632_379;
const DO_MESMO_CODIGO = 632_332;

const config = (maxPerCode: number): SchemaLayerConfig => ({
  enabled: true,
  failOn: "error",
  report: "warn",
  ignoredIssues: [],
  severityOverrides: {},
  maxIssues: 0,
  maxPerCode,
});

function issue(code: string, i: number): GltfIssue {
  return { code, message: `ocorrencia ${String(i)}`, severity: 1, pointer: `/meshes/${String(i)}` };
}

describe("append — o crash que o spread causava", () => {
  it("aguenta mais elementos do que cabe numa lista de argumentos", () => {
    const alvo: number[] = [];
    const origem = Array.from({ length: ISSUES_DO_ASSET_REAL }, (_, i) => i);
    // `alvo.push(...origem)` estoura aqui. Um laco nao.
    expect(() => { append(alvo, origem); }).not.toThrow();
    expect(alvo.length).toBe(ISSUES_DO_ASSET_REAL);
    expect(alvo[0]).toBe(0);
    expect(alvo.at(-1)).toBe(ISSUES_DO_ASSET_REAL - 1);
  });

  it("preserva a ordem, que e por onde alguem comeca a consertar", () => {
    const alvo = ["a"];
    append(alvo, ["b", "c"]);
    expect(alvo).toEqual(["a", "b", "c"]);
  });
});

describe("teto por codigo", () => {
  const muitas = [
    ...Array.from({ length: 500 }, (_, i) => issue("JOINTS_ZERO_WEIGHT", i)),
    ...Array.from({ length: 7 }, (_, i) => issue("UNUSED_OBJECT", i)),
    issue("NODE_EMPTY", 0),
  ];

  it("com 0, nao corta nada — o comportamento antigo nao muda", () => {
    const v = aplicarTetoPorCodigo(muitas, config(0));
    expect(v.length).toBe(508);
    expect(v.some((x) => x.code === TRUNCATED_CODE)).toBe(false);
  });

  it("corta por codigo e preserva a DIVERSIDADE", () => {
    const v = aplicarTetoPorCodigo(muitas, config(5));
    const porCodigo = new Map<string, number>();
    for (const x of v) porCodigo.set(x.code, (porCodigo.get(x.code) ?? 0) + 1);

    // O ponto do teto POR CODIGO: um teto global de 5 devolveria cinco copias
    // do codigo mais frequente e perderia os outros dois inteiros.
    expect(porCodigo.get("JOINTS_ZERO_WEIGHT")).toBe(5);
    expect(porCodigo.get("UNUSED_OBJECT")).toBe(5);
    expect(porCodigo.get("NODE_EMPTY")).toBe(1);
  });

  it("declara o que omitiu, ordenado por volume", () => {
    const v = aplicarTetoPorCodigo(muitas, config(5));
    const t = v.find((x) => x.code === TRUNCATED_CODE);
    expect(t).toBeDefined();
    expect(t?.severity).toBe("warn");
    const got = t?.got as { omitidas: Record<string, number> };
    expect(got.omitidas).toEqual({ JOINTS_ZERO_WEIGHT: 495, UNUSED_OBJECT: 2 });
    expect(Object.keys(got.omitidas)[0]).toBe("JOINTS_ZERO_WEIGHT");
  });

  it("nao corta quando cada codigo aparece uma vez — quebrado.glb e assim", () => {
    const quatroDistintos = ["UNDEFINED_PROPERTY", "TYPE_MISMATCH", "UNRESOLVED_REFERENCE", "UNUSED_OBJECT"]
      .map((c, i) => issue(c, i));
    const v = aplicarTetoPorCodigo(quatroDistintos, config(1));
    expect(v.length).toBe(4);
    expect(v.some((x) => x.code === TRUNCATED_CODE)).toBe(false);
  });

  it("o numero do asset real cabe no teto sem estourar", () => {
    const reais = Array.from({ length: DO_MESMO_CODIGO }, (_, i) => issue("JOINTS_ZERO_WEIGHT", i));
    const v = aplicarTetoPorCodigo(reais, config(50));
    expect(v.length).toBe(51); // 50 + a violacao de truncamento
    const got = v.at(-1)?.got as { omitidas: Record<string, number> };
    expect(got.omitidas["JOINTS_ZERO_WEIGHT"]).toBe(DO_MESMO_CODIGO - 50);
  });
});
