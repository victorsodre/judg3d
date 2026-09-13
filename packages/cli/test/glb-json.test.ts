import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { inspectExtras, stripUnusedExtras } from "@judg3d/judge";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const fixture = (name: string): string => join(repoRoot, "fixtures", name);

describe("GLB extras", () => {
  it("finds no extras on the Khronos Box fixture", async () => {
    const bytes = new Uint8Array(await readFile(fixture("valido.glb")));
    expect(inspectExtras(bytes).pointers).toEqual([]);
    expect(stripUnusedExtras(bytes).changed).toBe(false);
  });

  it("strips extras from a rewritten Box and keeps it a valid GLB", async () => {
    const original = new Uint8Array(await readFile(fixture("valido.glb")));
    const withExtras = injectExtras(original, {
      note: "authoring leftover",
      unused: true,
    });
    expect(inspectExtras(withExtras).pointers).toEqual(["/asset/extras", "/extras"]);

    const stripped = stripUnusedExtras(withExtras);
    expect(stripped.changed).toBe(true);
    expect(stripped.removed).toEqual(["/asset/extras", "/extras"]);
    expect(inspectExtras(stripped.bytes).pointers).toEqual([]);
    expect(stripped.bytes.byteLength).toBeLessThan(withExtras.byteLength);
    expect(new TextDecoder().decode(stripped.bytes.subarray(0, 4))).toBe("glTF");
  });

  it("strips extras from a .gltf JSON document", () => {
    const text = new TextEncoder().encode(
      JSON.stringify({
        asset: { version: "2.0", extras: { tool: "test" } },
        extras: { leftover: 1 },
      }),
    );
    const stripped = stripUnusedExtras(text);
    expect(stripped.changed).toBe(true);
    expect(stripped.removed).toEqual(["/asset/extras", "/extras"]);
    expect(JSON.parse(new TextDecoder().decode(stripped.bytes))).toEqual({
      asset: { version: "2.0" },
    });
  });
});

function injectExtras(
  bytes: Uint8Array,
  extras: Record<string, unknown>,
): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkLength = view.getUint32(12, true);
  const json = JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + chunkLength)),
  ) as {
    asset: Record<string, unknown>;
    extras?: unknown;
  };
  json.extras = extras;
  json.asset = { ...json.asset, extras };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunk = jsonBytes.byteLength + pad;
  const binStart = 20 + chunkLength;
  const rest = bytes.subarray(binStart);
  const out = new Uint8Array(12 + 8 + jsonChunk + rest.byteLength);
  const outView = new DataView(out.buffer);
  out.set(bytes.subarray(0, 12), 0);
  outView.setUint32(8, out.byteLength, true);
  outView.setUint32(12, jsonChunk, true);
  outView.setUint32(16, view.getUint32(16, true), true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonChunk);
  out.set(rest, 20 + jsonChunk);
  return out;
}
