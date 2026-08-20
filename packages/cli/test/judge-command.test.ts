import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { JudgeReport } from "@judg3d/core";

import { runJudgeCommand } from "../src/commands/judge.js";

const execFileAsync = promisify(execFile);

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const CLI_ENTRY = join(repoRoot, "packages/cli/dist/index.js");
const PROFILE = join(repoRoot, "profiles/web-commerce.json");
const fixture = (name: string): string => join(repoRoot, "fixtures", name);

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "judg3d-cli-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

type Capture = {
  out: string[];
  err: string[];
};

async function run(
  asset: string,
  overrides: Partial<{
    profile: string;
    out: string;
    json: boolean;
    timestamp: boolean;
  }> = {},
): Promise<{ code: number; capture: Capture; out: string }> {
  const out = overrides.out ?? join(workDir, `${crypto.randomUUID()}.json`);
  const capture: Capture = { out: [], err: [] };
  const code = await runJudgeCommand(
    asset,
    {
      profile: overrides.profile ?? PROFILE,
      out,
      json: overrides.json ?? false,
      timestamp: overrides.timestamp ?? false,
    },
    {
      judg3dVersion: "0.0.0-test",
      stdout: (line) => capture.out.push(line),
      stderr: (line) => capture.err.push(line),
    },
  );
  return { code, capture, out };
}

async function readReport(path: string): Promise<JudgeReport> {
  return JSON.parse(await readFile(path, "utf8")) as JudgeReport;
}

describe("judg3d judge — exit codes", () => {
  it("aprova valido.glb com exit 0 e grava o relatorio", async () => {
    const { code, capture, out } = await run(fixture("valido.glb"));
    expect(code).toBe(0);
    expect(capture.err).toEqual([]);
    expect(capture.out.join("\n")).toContain("APROVADO");

    const report = await readReport(out);
    expect(report.verdict.pass).toBe(true);
    expect(report.verdict.violations).toEqual([]);
  });

  it("aprova valido-textura.glb com exit 0", async () => {
    const { code } = await run(fixture("valido-textura.glb"));
    expect(code).toBe(0);
  });

  it("reprova quebrado.glb com exit 1 e violacoes legiveis", async () => {
    const { code, capture, out } = await run(fixture("quebrado.glb"));
    expect(code).toBe(1);

    const texto = capture.out.join("\n");
    expect(texto).toContain("REPROVADO");
    expect(texto).toContain("3 erros");
    expect(texto).toContain("UNRESOLVED_REFERENCE");
    expect(texto).toContain("/meshes/0/primitives/0/attributes/POSITION");
    expect(texto).toContain("Unresolved reference: 99.");

    const report = await readReport(out);
    expect(report.verdict.pass).toBe(false);
    expect(report.verdict.violations).toHaveLength(3);
  });

  it("da exit 2 quando o asset nao existe, sem gravar relatorio", async () => {
    const out = join(workDir, "nao-deve-existir.json");
    const { code, capture } = await run(fixture("nao-existe.glb"), { out });
    expect(code).toBe(2);
    expect(capture.err.join("\n")).toContain("Nao consegui ler o asset");
    expect(capture.err.join("\n")).toContain("nao uma reprovacao do asset");
    await expect(readFile(out, "utf8")).rejects.toThrow();
  });

  it("da exit 2 quando o profile nao existe", async () => {
    const { code, capture } = await run(fixture("valido.glb"), {
      profile: join(workDir, "sem-profile.json"),
    });
    expect(code).toBe(2);
    expect(capture.err.join("\n")).toContain("Nao consegui ler o profile");
  });

  it("da exit 2 quando o profile pede camada nao implementada", async () => {
    const profilePath = join(workDir, "com-l3.json");
    const base = JSON.parse(await readFile(PROFILE, "utf8")) as {
      layers: { geometry: { enabled: boolean } };
    };
    base.layers.geometry.enabled = true;
    await writeFile(profilePath, JSON.stringify(base));

    const { code, capture } = await run(fixture("valido.glb"), {
      profile: profilePath,
    });
    expect(code).toBe(2);
    expect(capture.err.join("\n")).toContain("GEOMETRY");
    expect(capture.err.join("\n")).toContain("falso PASS");
  });

  it("reprova arquivo que nao e glTF com exit 1, nao 2", async () => {
    const lixo = join(workDir, "lixo.glb");
    await writeFile(lixo, "isto definitivamente nao e um glb");

    const { code, capture } = await run(lixo);
    expect(code).toBe(1);
    expect(capture.out.join("\n")).toContain("GLTF_UNPARSEABLE");
  });
});

describe("judg3d judge — relatorio", () => {
  it("--json imprime o mesmo conteudo que grava", async () => {
    const { capture, out } = await run(fixture("quebrado.glb"), { json: true });
    const gravado = await readFile(out, "utf8");
    expect(`${capture.out.join("\n")}\n`).toBe(gravado);
  });

  it("e byte a byte identico entre duas execucoes", async () => {
    const a = await run(fixture("quebrado.glb"));
    const b = await run(fixture("quebrado.glb"));
    expect(await readFile(a.out, "utf8")).toBe(await readFile(b.out, "utf8"));
  });

  it("--timestamp adiciona generatedAt", async () => {
    const { out } = await run(fixture("valido.glb"), { timestamp: true });
    expect((await readReport(out)).generatedAt).toBeDefined();
  });
});

describe("judg3d — binario compilado", () => {
  it("responde com o exit code certo quando invocado de verdade", async () => {
    const out = join(workDir, "e2e.json");
    await expect(
      execFileAsync(process.execPath, [
        CLI_ENTRY,
        "judge",
        fixture("valido.glb"),
        "--profile",
        PROFILE,
        "--out",
        out,
      ]),
    ).resolves.toBeDefined();

    await expect(
      execFileAsync(process.execPath, [
        CLI_ENTRY,
        "judge",
        fixture("quebrado.glb"),
        "--profile",
        PROFILE,
        "--out",
        out,
      ]),
    ).rejects.toMatchObject({ code: 1 });
  });

  it("exige --profile", async () => {
    await expect(
      execFileAsync(process.execPath, [
        CLI_ENTRY,
        "judge",
        fixture("valido.glb"),
      ]),
    ).rejects.toMatchObject({ code: 1 });
  });
});
