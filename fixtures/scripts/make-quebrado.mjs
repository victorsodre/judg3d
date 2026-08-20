#!/usr/bin/env node
/**
 * Gera `fixtures/quebrado.glb` a partir de `fixtures/valido.glb`.
 *
 * A corrupcao e semantica, nao byte-rot: o container GLB continua bem formado
 * (magic, versao, comprimentos e padding corretos) e o JSON continua sendo
 * JSON. Assim o validator chega ate o conteudo e devolve violacoes legiveis,
 * que e o ponto do fixture — provar que o relatorio serve pra um agente ler e
 * consertar, nao so pra dizer "deu ruim".
 *
 * Os tres defeitos tem severidade Error confirmada no ISSUES.md da Khronos:
 *
 *   1. attributes.POSITION aponta pro accessor 99   -> UNRESOLVED_REFERENCE
 *   2. bufferViews[0] perde a propriedade `buffer`  -> UNDEFINED_PROPERTY
 *   3. primitives[0].mode vira string               -> TYPE_MISMATCH
 *
 * `asset.version` fica intacto de proposito: sem ele o validator devolve o
 * relatorio sem o bloco `info`, e o fixture deixaria de exercitar as metricas.
 *
 * O arquivo gerado e commitado e imutavel. Precisou de outro defeito? Novo
 * fixture, arquivo novo — nunca edicao no lugar.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_VERSION = 2;
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

/** Le um GLB e devolve o JSON parseado mais o chunk binario cru. */
function decodeGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("nao e um GLB (magic invalido)");
  }
  if (buffer.readUInt32LE(4) !== GLB_VERSION) {
    throw new Error("GLB nao e versao 2");
  }

  let json = null;
  let bin = null;
  let offset = HEADER_BYTES;

  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + CHUNK_HEADER_BYTES;
    const data = buffer.subarray(start, start + length);

    if (type === CHUNK_JSON) {
      json = JSON.parse(data.toString("utf8"));
    } else if (type === CHUNK_BIN) {
      bin = Buffer.from(data);
    }
    offset = start + length;
  }

  if (json === null) {
    throw new Error("GLB sem chunk JSON");
  }
  return { json, bin };
}

/** Monta um GLB valido a partir do JSON e do chunk binario. */
function encodeGlb(json, bin) {
  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  // Chunks sao alinhados em 4 bytes: JSON com espaco, BIN com zero.
  const jsonPadded = padTo4(jsonBytes, 0x20);
  const binPadded = bin === null ? null : padTo4(bin, 0x00);

  let total = HEADER_BYTES + CHUNK_HEADER_BYTES + jsonPadded.length;
  if (binPadded !== null) {
    total += CHUNK_HEADER_BYTES + binPadded.length;
  }

  const out = Buffer.alloc(total);
  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(GLB_VERSION, 4);
  out.writeUInt32LE(total, 8);

  let offset = HEADER_BYTES;
  out.writeUInt32LE(jsonPadded.length, offset);
  out.writeUInt32LE(CHUNK_JSON, offset + 4);
  jsonPadded.copy(out, offset + CHUNK_HEADER_BYTES);
  offset += CHUNK_HEADER_BYTES + jsonPadded.length;

  if (binPadded !== null) {
    out.writeUInt32LE(binPadded.length, offset);
    out.writeUInt32LE(CHUNK_BIN, offset + 4);
    binPadded.copy(out, offset + CHUNK_HEADER_BYTES);
  }

  return out;
}

function padTo4(bytes, filler) {
  const remainder = bytes.length % 4;
  if (remainder === 0) {
    return bytes;
  }
  return Buffer.concat([bytes, Buffer.alloc(4 - remainder, filler)]);
}

const source = join(FIXTURES_DIR, "valido.glb");
const target = join(FIXTURES_DIR, "quebrado.glb");

const { json, bin } = decodeGlb(await readFile(source));

// 1. Referencia pendurada: nao existe accessor 99.
json.meshes[0].primitives[0].attributes.POSITION = 99;

// 2. Propriedade obrigatoria ausente: bufferView sem buffer.
delete json.bufferViews[0].buffer;

// 3. Tipo errado: `mode` e um enum inteiro, nao o nome dele.
json.meshes[0].primitives[0].mode = "TRIANGLES";

const glb = encodeGlb(json, bin);
await writeFile(target, glb);

const digest = createHash("sha256").update(glb).digest("hex");
console.log(`ok  quebrado.glb  ${glb.length} B  sha256 ${digest.slice(0, 12)}`);
console.log(`    origem: valido.glb + 3 defeitos deliberados`);
