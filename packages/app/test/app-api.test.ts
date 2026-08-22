import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const profilesDir = join(repoRoot, "profiles");
const fixture = (name: string): string => join(repoRoot, "fixtures", name);

describe("app API", () => {
  const app = createApp({ profilesDir, serveClient: false });

  it("responde health", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; name: string };
    expect(body.ok).toBe(true);
    expect(body.name).toBe("judg3d-app");
  });

  it("lista profiles do monorepo", async () => {
    const res = await app.request("/api/profiles");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      profiles: Array<{ id: string; filename: string }>;
    };
    expect(body.profiles.some((p) => p.filename === "web-commerce.json")).toBe(
      true,
    );
  });

  it("julga valido.glb com exitHint 0", async () => {
    const bytes = await readFile(fixture("valido.glb"));
    const form = new FormData();
    form.set(
      "asset",
      new File([bytes], "valido.glb", { type: "model/gltf-binary" }),
    );
    form.set("profile", "web-commerce.json");

    const res = await app.request("/api/judge", { method: "POST", body: form });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      exitHint: number;
      report: { verdict: { pass: boolean } };
    };
    expect(body.ok).toBe(true);
    expect(body.exitHint).toBe(0);
    expect(body.report.verdict.pass).toBe(true);
  });

  it("julga quebrado.glb com exitHint 1 e violacoes", async () => {
    const bytes = await readFile(fixture("quebrado.glb"));
    const form = new FormData();
    form.set(
      "asset",
      new File([bytes], "quebrado.glb", { type: "model/gltf-binary" }),
    );
    form.set("profile", "web-commerce.json");

    const res = await app.request("/api/judge", { method: "POST", body: form });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      exitHint: number;
      report: { verdict: { pass: boolean; violations: unknown[] } };
    };
    expect(body.ok).toBe(true);
    expect(body.exitHint).toBe(1);
    expect(body.report.verdict.pass).toBe(false);
    expect(body.report.verdict.violations.length).toBeGreaterThan(0);
  });

  it("recusa path traversal no profile", async () => {
    const bytes = await readFile(fixture("valido.glb"));
    const form = new FormData();
    form.set("asset", new File([bytes], "valido.glb"));
    form.set("profile", "../package.json");

    const res = await app.request("/api/judge", { method: "POST", body: form });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; exitHint: number };
    expect(body.ok).toBe(false);
    expect(body.exitHint).toBe(2);
  });
});
