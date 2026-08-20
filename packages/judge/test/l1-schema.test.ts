import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { loadProfile, parseProfile, InfraError } from "@judg3d/core";
import type { LoadedProfile } from "@judg3d/core";

import { judge, readAsset, UNPARSEABLE_CODE } from "../src/index.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const fixture = (name: string): string => `${repoRoot}fixtures/${name}`;
const PROFILE_PATH = `${repoRoot}profiles/web-commerce.json`;

const OPTIONS = { judg3dVersion: "0.0.0-test" };

async function webCommerce(): Promise<LoadedProfile> {
  return loadProfile(PROFILE_PATH);
}

/** Profile derivado do web-commerce, com a camada SCHEMA ajustada. */
function derived(
  patch: Record<string, unknown>,
  layers?: Record<string, unknown>,
): LoadedProfile {
  const base = {
    id: "derivado",
    version: "0.0.1",
    profileFormat: 1,
    extends: null,
    layers: {
      schema: { enabled: true, ...patch },
      profile: { enabled: false },
      geometry: { enabled: false },
      visual: { enabled: false },
      semantic: { enabled: false },
      ...layers,
    },
  };
  return {
    profile: parseProfile(JSON.stringify(base), "derivado.json"),
    sha256: "0".repeat(64),
    source: "derivado.json",
  };
}

describe("L1 SCHEMA nos fixtures validos", () => {
  it("aprova valido.glb sem nenhuma violacao", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("valido.glb")),
      await webCommerce(),
      OPTIONS,
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.violations).toEqual([]);
    expect(verdict.metrics).toEqual({
      triangles: 12,
      vertices: 24,
      materials: 1,
      drawCalls: 1,
    });
    expect(verdict.views).toEqual([]);
  });

  it("aprova valido-textura.glb", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("valido-textura.glb")),
      await webCommerce(),
      OPTIONS,
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.violations).toEqual([]);
  });
});

describe("L1 SCHEMA no fixture quebrado", () => {
  it("reprova com as tres violacoes deliberadas, cada uma localizada", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("quebrado.glb")),
      await webCommerce(),
      OPTIONS,
    );

    expect(verdict.pass).toBe(false);
    expect(verdict.violations).toHaveLength(3);

    const byCode = new Map(verdict.violations.map((v) => [v.code, v]));
    expect([...byCode.keys()].sort()).toEqual([
      "TYPE_MISMATCH",
      "UNDEFINED_PROPERTY",
      "UNRESOLVED_REFERENCE",
    ]);

    expect(byCode.get("UNRESOLVED_REFERENCE")?.nodePath).toBe(
      "/meshes/0/primitives/0/attributes/POSITION",
    );
    expect(byCode.get("UNDEFINED_PROPERTY")?.nodePath).toBe("/bufferViews/0");
    expect(byCode.get("TYPE_MISMATCH")?.nodePath).toBe(
      "/meshes/0/primitives/0/mode",
    );

    for (const violation of verdict.violations) {
      expect(violation.kind).toBe("SCHEMA");
      expect(violation.severity).toBe("error");
      // Invariante 4: codigo + local + got/want.
      expect(violation.got).toMatchObject({ severity: "Error" });
      expect(violation.want).toMatchObject({ conformance: "glTF 2.0" });
      expect(String((violation.got as { message: string }).message).length)
        .toBeGreaterThan(0);
    }
  });

  it("filtra Information por padrao e inclui quando o profile pede", async () => {
    const asset = await readAsset(fixture("quebrado.glb"));

    const padrao = await judge(asset, await webCommerce(), OPTIONS);
    expect(padrao.verdict.violations.map((v) => v.code)).not.toContain(
      "UNUSED_OBJECT",
    );

    const verboso = await judge(asset, derived({ report: "info" }), OPTIONS);
    expect(verboso.verdict.violations.map((v) => v.code)).toContain(
      "UNUSED_OBJECT",
    );
    // Information nao e erro: continua reprovado pelos outros tres, nao por ele.
    expect(
      verboso.verdict.violations.find((v) => v.code === "UNUSED_OBJECT")
        ?.severity,
    ).toBe("warn");
  });

  it("honra ignoredIssues do profile", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("quebrado.glb")),
      derived({ ignoredIssues: ["TYPE_MISMATCH"] }),
      OPTIONS,
    );
    expect(verdict.violations.map((v) => v.code)).not.toContain("TYPE_MISMATCH");
    expect(verdict.violations).toHaveLength(2);
    expect(verdict.pass).toBe(false);
  });
});

describe("tolerancia mora no profile", () => {
  it("failOn error deixa aviso passar; failOn warn reprova", async () => {
    // O UNUSED_OBJECT do quebrado vira aviso quando o profile pede report info.
    const asset = await readAsset(fixture("quebrado.glb"));
    const soAvisos = derived({
      report: "info",
      ignoredIssues: [
        "UNRESOLVED_REFERENCE",
        "UNDEFINED_PROPERTY",
        "TYPE_MISMATCH",
      ],
    });

    const comErro = await judge(asset, soAvisos, OPTIONS);
    expect(comErro.verdict.violations.map((v) => v.severity)).toEqual(["warn"]);
    expect(comErro.verdict.pass).toBe(true);

    const estrito = await judge(
      asset,
      derived({
        report: "info",
        failOn: "warn",
        ignoredIssues: [
          "UNRESOLVED_REFERENCE",
          "UNDEFINED_PROPERTY",
          "TYPE_MISMATCH",
        ],
      }),
      OPTIONS,
    );
    expect(estrito.verdict.pass).toBe(false);
  });

  it("severityOverrides rebaixa a severidade e muda o veredito", async () => {
    const { verdict } = await judge(
      await readAsset(fixture("quebrado.glb")),
      derived({
        severityOverrides: {
          UNRESOLVED_REFERENCE: 1,
          UNDEFINED_PROPERTY: 1,
          TYPE_MISMATCH: 1,
        },
      }),
      OPTIONS,
    );
    expect(verdict.violations).toHaveLength(3);
    expect(verdict.violations.every((v) => v.severity === "warn")).toBe(true);
    expect(verdict.pass).toBe(true);
  });
});

describe("nunca um falso PASS", () => {
  it("arquivo que nao e glTF reprova, e nao vira erro de infra", async () => {
    const { verdict } = await judge(
      { bytes: new TextEncoder().encode("isto nao e um glb"), uri: "lixo.bin" },
      await webCommerce(),
      OPTIONS,
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.violations).toHaveLength(1);
    expect(verdict.violations[0]?.code).toBe(UNPARSEABLE_CODE);
    expect(verdict.violations[0]?.severity).toBe("error");
  });

  it("camada habilitada e nao implementada e erro de infra", async () => {
    await expect(
      judge(
        await readAsset(fixture("valido.glb")),
        derived({}, { visual: { enabled: true } }),
        OPTIONS,
      ),
    ).rejects.toThrow(InfraError);
  });

  it("asset inexistente e erro de infra", async () => {
    await expect(readAsset(fixture("nao-existe.glb"))).rejects.toThrow(
      InfraError,
    );
  });
});

describe("relatorio", () => {
  it("carrega proveniencia e e deterministico sem timestamp", async () => {
    const asset = await readAsset(fixture("quebrado.glb"));
    const profile = await webCommerce();

    const primeiro = await judge(asset, profile, OPTIONS);
    const segundo = await judge(asset, profile, OPTIONS);

    expect(JSON.stringify(primeiro.report)).toBe(JSON.stringify(segundo.report));
    expect(primeiro.report.generatedAt).toBeUndefined();

    const bytes = await readFile(fixture("quebrado.glb"));
    expect(primeiro.report.asset.bytes).toBe(bytes.byteLength);
    expect(primeiro.report.asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(primeiro.report.profile.id).toBe("web-commerce");
    expect(primeiro.report.engine.layers).toEqual(["SCHEMA"]);
    expect(primeiro.report.engine.gltfValidator).toMatch(/^2\./);
  });

  it("inclui generatedAt quando pedido", async () => {
    const { report } = await judge(
      await readAsset(fixture("valido.glb")),
      await webCommerce(),
      { ...OPTIONS, timestamp: true },
    );
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
