import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { loadProfile } from "@judg3d/core";
import { judgeIsolated, readAsset } from "@judg3d/judge";

const root = fileURLToPath(new URL("../../../", import.meta.url));
async function input() {
  return {
    asset: await readAsset(`${root}fixtures/valido.glb`),
    profile: await loadProfile(`${root}profiles/web-commerce.json`),
    options: { judg3dVersion: "test" },
  };
}

it("cancela uma análise e permite nova execução", async () => {
  const controller = new AbortController();
  const job = judgeIsolated(await input(), { signal: controller.signal });
  controller.abort();
  await expect(job).rejects.toThrow("cancelled");
  expect((await judgeIsolated(await input())).verdict.pass).toBe(true);
});

it("recusa cancelamento prévio e prazos inválidos", async () => {
  await expect(
    judgeIsolated(await input(), { signal: AbortSignal.abort() }),
  ).rejects.toThrow("cancelled");
  await expect(
    judgeIsolated(await input(), { timeoutMs: Infinity }),
  ).rejects.toThrow("Timeout");
});
