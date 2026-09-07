import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { InfraError, loadProfile, type LoadedProfile } from "@judg3d/core";
import { judge, readAsset } from "../src/index.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const options = { judg3dVersion: "test" };
const ignoredIssues = [
  "UNRESOLVED_REFERENCE",
  "UNDEFINED_PROPERTY",
  "TYPE_MISMATCH",
];

async function profile(): Promise<LoadedProfile> {
  return loadProfile(`${root}profiles/web-commerce.json`);
}

describe("integridade do veredito", () => {
  it.each(["empty", "extends", "prerequisite"])(
    "recusa configuração inexequível: %s",
    async (mode) => {
      const loaded = await profile();
      if (mode === "extends") loaded.profile.extends = "unimplemented.json";
      else loaded.profile.layers.schema.enabled = false;
      if (mode === "prerequisite") loaded.profile.layers.profile.enabled = true;
      await expect(
        judge(await readAsset(`${root}fixtures/valido.glb`), loaded, options),
      ).rejects.toThrow(InfraError);
    },
  );

  it("report:error não esconde o aviso que reprova com failOn:warn", async () => {
    const loaded = await profile();
    Object.assign(loaded.profile.layers.schema, {
      ignoredIssues,
      failOn: "warn",
      report: "error",
      severityOverrides: { UNUSED_OBJECT: 1 },
    });
    const { verdict } = await judge(
      await readAsset(`${root}fixtures/quebrado.glb`),
      loaded,
      options,
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.violations).toContainEqual(
      expect.objectContaining({ code: "UNUSED_OBJECT" }),
    );
  });

  it("aumentar a verbosidade não transforma Information em reprovação", async () => {
    const loaded = await profile();
    Object.assign(loaded.profile.layers.schema, {
      ignoredIssues,
      failOn: "warn",
      report: "info",
    });
    const { verdict } = await judge(
      await readAsset(`${root}fixtures/quebrado.glb`),
      loaded,
      options,
    );
    expect(verdict.violations).toHaveLength(1);
    expect(verdict.pass).toBe(true);
  });

  it("não emite veredito com validação interrompida por maxIssues", async () => {
    const loaded = await profile();
    loaded.profile.layers.schema.maxIssues = 1;
    await expect(
      judge(await readAsset(`${root}fixtures/quebrado.glb`), loaded, options),
    ).rejects.toThrow(InfraError);
  });
});
