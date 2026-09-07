import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { runJudgeJob } from "../src/judge-job.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const profilesDir = join(repoRoot, "profiles");

describe("limites e origem da API local", () => {
  it("produção não aceita a origem de desenvolvimento", async () => {
    const app = createApp({ profilesDir });
    expect(
      (
        await app.request("/api/health", {
          headers: { Origin: "http://localhost:5173" },
        })
      ).status,
    ).toBe(403);
  });

  it("não serve dotfiles, links externos, assets ausentes ou HTML em rotas da API", async () => {
    const root = await mkdtemp(join(tmpdir(), "judg3d-static-"));
    const clientDist = join(root, "client");
    await mkdir(clientDist);
    await writeFile(join(clientDist, "index.html"), "<h1>judg3d</h1>");
    await writeFile(join(clientDist, ".env"), "private");
    await writeFile(join(root, "outside.txt"), "private");
    await symlink(join(root, "outside.txt"), join(clientDist, "alias.txt"));
    const app = createApp({ profilesDir, serveClient: true, clientDist });
    try {
      const home = await app.request("/");
      expect(home.status).toBe(200);
      expect(home.headers.get("Content-Security-Policy")).toContain(
        "frame-ancestors 'none'",
      );
      for (const path of [
        "/.env",
        "/%2eenv",
        "/alias.txt",
        "/missing.js",
        "/%zz",
        "/api/missing",
      ]) {
        const response = await app.request(path);
        expect(response.status, path).toBe(404);
        expect(await response.text()).not.toContain("private");
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("recusa profile que é link simbólico", async () => {
    const dir = await mkdtemp(join(tmpdir(), "judg3d-profiles-"));
    try {
      await symlink(
        join(profilesDir, "web-commerce.json"),
        join(dir, "alias.json"),
      );
      const form = new FormData();
      form.set("asset", new File(["x"], "x.glb"));
      form.set("profile", "alias.json");
      expect(
        (
          await createApp({ profilesDir: dir }).request("/api/judge", {
            method: "POST",
            body: form,
          })
        ).status,
      ).toBe(400);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("limita upload sem Content-Length, rejeita concorrência e libera a vaga após erro", async () => {
    const app = createApp({
      profilesDir,
      maxUploadBytes: 1024,
      maxConcurrentJobs: 1,
    });
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    let signalRead: (() => void) | undefined;
    const reading = new Promise<void>((resolve) => {
      signalRead = resolve;
    });
    const body = new ReadableStream<Uint8Array>(
      {
        start(value) {
          controller = value;
        },
        pull() {
          signalRead?.();
        },
      },
      { highWaterMark: 0 },
    );
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      body,
      duplex: "half",
    };
    const first = app.request(new Request("http://localhost/api/judge", init));
    await reading;
    expect((await app.request("/api/judge", { method: "POST" })).status).toBe(
      429,
    );
    controller?.enqueue(new Uint8Array(2048));
    controller?.close();
    expect((await first).status).toBe(413);
    expect((await app.request("/api/judge", { method: "POST" })).status).toBe(
      400,
    );
  });

  it("encerra o worker quando o prazo de processamento acaba", async () => {
    const bytes = await readFile(join(repoRoot, "fixtures/valido.glb"));
    await expect(
      runJudgeJob(
        {
          bytes,
          uri: "teste.glb",
          profilePath: join(profilesDir, "web-commerce.json"),
          version: "test",
        },
        1,
      ),
    ).rejects.toThrow("Analysis exceeded the time limit.");
  });

  it("recusa upload acima do limite antes do parsing", async () => {
    const app = createApp({ profilesDir, maxUploadBytes: 1024 });
    const body = new FormData();
    body.set("asset", new File([new Uint8Array(2048)], "teste.glb"));
    const result = await app.request("/api/judge", { method: "POST", body });
    expect(result.status).toBe(413);
  });

  it("recusa formulários de outra origem", async () => {
    const app = createApp({ profilesDir });
    const bytes = await readFile(join(repoRoot, "fixtures/valido.glb"));
    const body = new FormData();
    body.set("asset", new File([bytes], "teste.glb"));
    const result = await app.request("/api/judge", {
      method: "POST",
      body,
      headers: { Origin: "https://untrusted.example" },
    });
    expect(result.status).toBe(403);
  });

  it("recusa hostname externo mesmo quando chega ao processo local", async () => {
    const app = createApp({ profilesDir });
    const result = await app.request("http://untrusted.example/api/health");
    expect(result.status).toBe(403);
  });

  it("usa allowHeaders explícito no preflight", async () => {
    const app = createApp({ profilesDir, development: true });
    const result = await app.request("/api/judge", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Headers": "X-Unexpected",
      },
    });
    expect(result.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
  });

  it("não expõe caminhos locais na listagem de profiles", async () => {
    const app = createApp({ profilesDir });
    const response = await app.request("/api/profiles");
    expect(await response.text()).not.toContain(profilesDir);
  });
});
