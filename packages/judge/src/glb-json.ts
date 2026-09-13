/** GLB/glTF container JSON access. This is not a glTF semantic parser. */

const GLB_MAGIC = 0x46_54_6c_67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e_4f_53_4a;
const BIN_CHUNK = 0x00_4e_49_42;

export type ExtrasInspection = {
  pointers: string[];
};

export type StripExtrasResult = {
  bytes: Uint8Array;
  removed: string[];
  changed: boolean;
};

/** JSON pointers to `extras` objects found in a GLB JSON chunk or a .gltf document. */
export function inspectExtras(bytes: Uint8Array): ExtrasInspection {
  const document = readJsonDocument(bytes);
  if (document === undefined) {
    return { pointers: [] };
  }
  return { pointers: collectExtrasPointers(document) };
}

/** Remove `extras` keys from the glTF JSON. Binary chunks are preserved. */
export function stripUnusedExtras(bytes: Uint8Array): StripExtrasResult {
  const glb = parseGlb(bytes);
  if (glb !== undefined) {
    const removed = collectExtrasPointers(glb.json);
    if (removed.length === 0) {
      return { bytes, removed, changed: false };
    }
    const stripped = structuredClone(glb.json);
    deleteExtras(stripped);
    return {
      bytes: writeGlb(stripped, glb.bin),
      removed,
      changed: true,
    };
  }

  const json = parseJsonBytes(bytes);
  if (json === undefined) {
    return { bytes, removed: [], changed: false };
  }
  const removed = collectExtrasPointers(json);
  if (removed.length === 0) {
    return { bytes, removed, changed: false };
  }
  const stripped = structuredClone(json);
  deleteExtras(stripped);
  return {
    bytes: new TextEncoder().encode(`${JSON.stringify(stripped, null, 2)}\n`),
    removed,
    changed: true,
  };
}

function readJsonDocument(bytes: Uint8Array): unknown {
  return parseGlb(bytes)?.json ?? parseJsonBytes(bytes);
}

function parseJsonBytes(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

function parseGlb(
  bytes: Uint8Array,
): { json: unknown; bin: Uint8Array | undefined } | undefined {
  if (bytes.byteLength < 20) {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    return undefined;
  }
  if (view.getUint32(4, true) !== GLB_VERSION) {
    return undefined;
  }
  if (view.getUint32(8, true) !== bytes.byteLength) {
    return undefined;
  }

  let offset = 12;
  let json: unknown;
  let bin: Uint8Array | undefined;
  while (offset + 8 <= bytes.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + chunkLength > bytes.byteLength) {
      return undefined;
    }
    const chunk = bytes.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === JSON_CHUNK) {
      try {
        json = JSON.parse(new TextDecoder().decode(chunk));
      } catch {
        return undefined;
      }
    } else if (chunkType === BIN_CHUNK) {
      bin = chunk;
    }
  }
  if (json === undefined) {
    return undefined;
  }
  return { json, bin };
}

function writeGlb(json: unknown, bin: Uint8Array | undefined): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunkLength = jsonBytes.byteLength + jsonPad;
  const hasBin = bin !== undefined;
  const binPad = hasBin ? (4 - (bin.byteLength % 4)) % 4 : 0;
  const binChunkLength = hasBin ? bin.byteLength + binPad : 0;
  const total = 12 + 8 + jsonChunkLength + (hasBin ? 8 + binChunkLength : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunkLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonChunkLength);
  if (hasBin) {
    const start = 20 + jsonChunkLength;
    view.setUint32(start, binChunkLength, true);
    view.setUint32(start + 4, BIN_CHUNK, true);
    out.set(bin, start + 8);
  }
  return out;
}

function collectExtrasPointers(value: unknown): string[] {
  const pointers: string[] = [];
  walk(value, "", (node, path) => {
    if (isRecord(node) && node["extras"] !== undefined) {
      pointers.push(`${path}/extras`);
    }
  });
  pointers.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return pointers;
}

function deleteExtras(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      deleteExtras(item);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  delete value["extras"];
  for (const key of Object.keys(value)) {
    deleteExtras(value[key]);
  }
}

function walk(
  value: unknown,
  path: string,
  visit: (node: unknown, path: string) => void,
): void {
  visit(value, path);
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      walk(item, `${path}/${index}`, visit);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const key of Object.keys(value)) {
    if (key === "extras") {
      continue;
    }
    walk(value[key], `${path}/${escapePointer(key)}`, visit);
  }
}

function escapePointer(key: string): string {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
