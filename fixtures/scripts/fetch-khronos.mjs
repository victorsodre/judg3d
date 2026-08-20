#!/usr/bin/env node
/**
 * Baixa os fixtures validos do repositorio oficial glTF-Sample-Assets da
 * Khronos, pinados num commit, e confere o sha256 antes de gravar.
 *
 * Os .glb ficam commitados no repo (6 KB no total) para os testes rodarem
 * offline e para o fixture ser imutavel. Este script existe pela proveniencia:
 * qualquer pessoa consegue provar de onde o arquivo veio.
 *
 *   node fixtures/scripts/fetch-khronos.mjs [--check]
 *
 * --check nao grava nada, so confere os arquivos que ja estao em disco.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

/** Commit pinado de KhronosGroup/glTF-Sample-Assets. */
const COMMIT = "bf2bb4a81c73a7ceb53e80df3dec0105c5a3fdef";

const FIXTURES = [
  {
    target: "valido.glb",
    source: "Models/Box/glTF-Binary/Box.glb",
    sha256: "ed52f7192b8311d700ac0ce80644e3852cd01537e4d62241b9acba023da3d54e",
    bytes: 1664,
  },
  {
    target: "valido-textura.glb",
    source: "Models/BoxTextured/glTF-Binary/BoxTextured.glb",
    sha256: "b510eca2e2ef33f62f9ed57d6e7ce2d10ebb2bdebc4a8e59d347719ba81abdf4",
    bytes: 5956,
  },
];

const checkOnly = process.argv.includes("--check");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function main() {
  for (const fixture of FIXTURES) {
    const path = join(FIXTURES_DIR, fixture.target);

    let bytes;
    if (checkOnly) {
      bytes = await readFile(path);
    } else {
      const url = `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/${COMMIT}/${fixture.source}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${url} respondeu ${response.status}`);
      }
      bytes = Buffer.from(await response.arrayBuffer());
    }

    const digest = sha256(bytes);
    if (digest !== fixture.sha256) {
      throw new Error(
        `${fixture.target}: sha256 ${digest} nao bate com o esperado ${fixture.sha256}`,
      );
    }
    if (bytes.length !== fixture.bytes) {
      throw new Error(
        `${fixture.target}: ${bytes.length} bytes, esperado ${fixture.bytes}`,
      );
    }

    if (!checkOnly) {
      await writeFile(path, bytes);
    }
    console.log(`ok  ${fixture.target}  ${bytes.length} B  sha256 ${digest.slice(0, 12)}`);
  }
}

await main();
