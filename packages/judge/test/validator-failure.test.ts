import { afterEach, expect, it, vi } from "vitest";
import { parseProfile } from "@judg3d/core";
import { validateBytes } from "gltf-validator";
import { runSchemaLayer } from "../src/layers/l1-schema.js";

vi.mock("gltf-validator", () => ({ validateBytes: vi.fn() }));
afterEach(() => {
  vi.resetAllMocks();
});

const config = parseProfile(
  JSON.stringify({
    id: "test",
    version: "1",
    profileFormat: 1,
    extends: null,
    layers: {
      schema: { enabled: true },
      profile: { enabled: false },
      geometry: { enabled: false },
      visual: { enabled: false },
      semantic: { enabled: false },
    },
  }),
  "test",
).layers.schema;

it("erro interno do validator vira infraestrutura, sem atribuir defeito ao asset", async () => {
  vi.mocked(validateBytes).mockRejectedValue(new TypeError("internal failure"));
  await expect(
    runSchemaLayer(new Uint8Array(), "asset.glb", config),
  ).rejects.toThrow("Internal glTF Validator failure");
});

it("resumir Information não transforma o aviso de truncamento em reprovação", async () => {
  vi.mocked(validateBytes).mockResolvedValue({
    validatorVersion: "test",
    issues: {
      numErrors: 0,
      numWarnings: 0,
      numInfos: 2,
      numHints: 0,
      truncated: false,
      messages: [0, 1].map((index) => ({
        code: "UNUSED_OBJECT",
        severity: 2,
        pointer: `/nodes/${index}`,
        message: "Unused.",
      })),
    },
  });
  const result = await runSchemaLayer(new Uint8Array(), "asset.glb", {
    ...config,
    report: "info",
    failOn: "warn",
    maxPerCode: 1,
  });
  expect(result.violations.at(-1)?.code).toBe("ISSUES_TRUNCATED");
  expect(result.pass).toBe(true);
});
