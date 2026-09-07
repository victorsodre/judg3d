import { fileURLToPath } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import { loadProfile, serializeReport } from "@judg3d/core";
import { judge, readAsset } from "@judg3d/judge";
import { fetchProfiles, judgeAsset } from "../ui/src/api.js";
import { apiError } from "../src/api-errors.js";
import { errorKey, messages } from "../ui/src/messages.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
afterEach(() => {
  vi.unstubAllGlobals();
});

it("não apresenta um PASS malformado, contraditório ou diferente do download", async () => {
  const { report } = await judge(
    await readAsset(`${root}fixtures/valido.glb`),
    await loadProfile(`${root}profiles/web-commerce.json`),
    { judg3dVersion: "test" },
  );
  const valid = {
    ok: true,
    exitHint: 0,
    report,
    serialized: serializeReport(report),
  };
  for (const body of [
    { ...valid, report: { verdict: { pass: true } } },
    { ...valid, exitHint: 1 },
    { ...valid, serialized: "{}" },
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    await expect(
      judgeAsset(new File(["x"], "x.glb"), "profile.json"),
    ).rejects.toThrow();
  }
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(valid)));
  await expect(
    judgeAsset(new File(["x"], "x.glb"), "profile.json"),
  ).resolves.toMatchObject(valid);

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ ...valid, serialized: "{" })),
  );
  await judgeAsset(new File(["x"], "x.glb"), "profile.json").then(
    () => {
      throw new Error("Malformed serialized report was accepted.");
    },
    (error: unknown) => {
      expect(errorKey(error)).toBe("invalidReport");
    },
  );
});

it("presents stable API error codes without changing the wire response", async () => {
  const body = apiError("PROFILE_NOT_FOUND");
  const fetch = vi.fn().mockResolvedValue(Response.json(body, { status: 400 }));
  vi.stubGlobal("fetch", fetch);
  const result = await judgeAsset(new File(["x"], "x.glb"), "missing.json");
  expect(result).toEqual(body);
  if (result.ok) throw new Error("Expected an API failure.");
  expect(result.message).toBe("Profile not found or invalid.");
  expect(messages.en[result.code]).toBe(
    "The profile was not found or is invalid.",
  );
  expect(fetch).toHaveBeenCalledTimes(1);

  fetch.mockResolvedValue(
    Response.json({ ...body, code: "UNKNOWN" }, { status: 400 }),
  );
  await expect(
    judgeAsset(new File(["x"], "x.glb"), "missing.json"),
  ).rejects.toThrow("invalid result");
});

it("explica resposta HTML e recusa lista de profiles inválida", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("<html>", { headers: { "Content-Type": "text/html" } }),
      ),
  );
  await expect(fetchProfiles()).rejects.toThrow("did not return valid JSON");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ profiles: [{ filename: "x" }] })),
  );
  await expect(fetchProfiles()).rejects.toThrow("invalid profile list");
});
