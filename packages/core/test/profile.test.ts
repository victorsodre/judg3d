import { describe, expect, it } from "vitest";

import {
  InfraError,
  assertLayersImplemented,
  enabledLayers,
  parseProfile,
  sha256Hex,
  serializeReport,
  type JudgeReport,
} from "../src/index.js";

const MINIMAL = {
  id: "teste",
  version: "0.1.0",
  profileFormat: 1,
  extends: null,
  layers: {
    schema: { enabled: true },
    profile: { enabled: false },
    geometry: { enabled: false },
    visual: { enabled: false },
    semantic: { enabled: false },
  },
};

function profileWith(patch: Record<string, unknown>): string {
  return JSON.stringify({ ...MINIMAL, ...patch });
}

describe("parseProfile", () => {
  it("aplica os defaults da camada SCHEMA", () => {
    const profile = parseProfile(JSON.stringify(MINIMAL), "teste.json");
    expect(profile.layers.schema).toEqual({
      enabled: true,
      failOn: "error",
      report: "warn",
      ignoredIssues: [],
      severityOverrides: {},
      maxIssues: 0,
      // 0 = ilimitado: o default preserva o comportamento anterior ao teto
      // por codigo, que entrou depois de um asset real derrubar o CLI.
      maxPerCode: 0,
    });
  });

  it("preserva tolerancia declarada no arquivo", () => {
    const profile = parseProfile(
      profileWith({
        layers: {
          ...MINIMAL.layers,
          schema: {
            enabled: true,
            failOn: "warn",
            report: "hint",
            ignoredIssues: ["UNUSED_OBJECT"],
            severityOverrides: { ACCESSOR_INDEX_TRIANGLE_DEGENERATE: 0 },
            maxIssues: 25,
          },
        },
      }),
      "teste.json",
    );
    expect(profile.layers.schema.failOn).toBe("warn");
    expect(profile.layers.schema.ignoredIssues).toEqual(["UNUSED_OBJECT"]);
    expect(profile.layers.schema.severityOverrides).toEqual({
      ACCESSOR_INDEX_TRIANGLE_DEGENERATE: 0,
    });
  });

  it("rejeita chave desconhecida em vez de ignorar em silencio", () => {
    const raw = profileWith({ budgetMaxTris: 5000 });
    expect(() => parseProfile(raw, "teste.json")).toThrow(InfraError);
    expect(() => parseProfile(raw, "teste.json")).toThrow(/Profile invalido/);
  });

  it("rejeita typo dentro da camada SCHEMA", () => {
    const raw = profileWith({
      layers: {
        ...MINIMAL.layers,
        schema: { enabled: true, ignoreIssues: ["UNUSED_OBJECT"] },
      },
    });
    expect(() => parseProfile(raw, "teste.json")).toThrow(InfraError);
  });

  it("rejeita JSON malformado com detalhe legivel", () => {
    try {
      parseProfile("{ nao e json", "teste.json");
      expect.unreachable("deveria ter lancado");
    } catch (error) {
      expect(error).toBeInstanceOf(InfraError);
      expect((error as InfraError).detail).toBeTruthy();
    }
  });
});

describe("assertLayersImplemented", () => {
  it("aceita profile que so liga SCHEMA", () => {
    const profile = parseProfile(JSON.stringify(MINIMAL), "teste.json");
    expect(enabledLayers(profile)).toEqual(["SCHEMA"]);
    expect(() => {
      assertLayersImplemented(profile);
    }).not.toThrow();
  });

  it("recusa camada habilitada e nao implementada — nunca um falso PASS", () => {
    const profile = parseProfile(
      profileWith({
        layers: { ...MINIMAL.layers, geometry: { enabled: true } },
      }),
      "teste.json",
    );
    expect(() => {
      assertLayersImplemented(profile);
    }).toThrow(/GEOMETRY/);
  });
});

describe("sha256Hex", () => {
  it("e estavel para os mesmos bytes", () => {
    const a = sha256Hex(new Uint8Array([1, 2, 3]));
    const b = sha256Hex(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("muda quando um byte muda", () => {
    expect(sha256Hex(new Uint8Array([1, 2, 3]))).not.toBe(
      sha256Hex(new Uint8Array([1, 2, 4])),
    );
  });
});

describe("serializeReport", () => {
  it("serializa deterministicamente e termina com newline", () => {
    const report: JudgeReport = {
      judg3dVersion: "0.0.0",
      asset: { uri: "a.glb", sha256: "abc", bytes: 10 },
      profile: { id: "teste", version: "0.1.0", sha256: "def" },
      engine: { gltfValidator: "2.0.0", node: "v26.0.0", layers: ["SCHEMA"] },
      verdict: {
        pass: true,
        violations: [],
        views: [],
        metrics: { triangles: 12, vertices: 24, materials: 1, drawCalls: 1 },
      },
    };
    const first = serializeReport(report);
    expect(first).toBe(serializeReport(report));
    expect(first.endsWith("}\n")).toBe(true);
  });
});
