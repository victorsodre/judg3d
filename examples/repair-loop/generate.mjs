import assert from "node:assert/strict";

/** Original MIT-licensed demo geometry: six planar faces, with redundant subdivisions. */
export function makeBox(subdivisions) {
  assert(
    [1, 16].includes(subdivisions),
    "Use one of the two bounded demo meshes.",
  );
  const positions = [];
  const normals = [];
  const indices = [];
  const faces = [
    [
      [1, 0, 0],
      [0, 0, -1],
      [0, 1, 0],
    ],
    [
      [-1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, -1],
    ],
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, -1],
      [-1, 0, 0],
      [0, 1, 0],
    ],
  ];
  for (const [normal, u, v] of faces) {
    const base = positions.length / 3;
    for (let row = 0; row <= subdivisions; row++) {
      for (let column = 0; column <= subdivisions; column++) {
        for (let axis = 0; axis < 3; axis++) {
          positions.push(
            normal[axis] +
              u[axis] * ((2 * column) / subdivisions - 1) +
              v[axis] * ((2 * row) / subdivisions - 1),
          );
        }
        normals.push(...normal);
      }
    }
    for (let row = 0; row < subdivisions; row++) {
      for (let column = 0; column < subdivisions; column++) {
        const a = base + row * (subdivisions + 1) + column;
        const b = a + 1;
        const c = a + subdivisions + 1;
        indices.push(a, b, c, b, c + 1, c);
      }
    }
  }
  const vertexCount = positions.length / 3;
  assert.equal(indices.length / 3, 12 * subdivisions ** 2);
  assert(indices.every((index) => index < vertexCount));
  const vertexBytes = positions.length * 4;
  const binary = Buffer.alloc(vertexBytes * 2 + indices.length * 2);
  positions.forEach((value, i) => binary.writeFloatLE(value, i * 4));
  normals.forEach((value, i) =>
    binary.writeFloatLE(value, vertexBytes + i * 4),
  );
  indices.forEach((value, i) =>
    binary.writeUInt16LE(value, vertexBytes * 2 + i * 2),
  );
  const document = {
    asset: { version: "2.0", generator: "judg3d repair-loop demo" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "Demo box", mesh: 0 }],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.18, 0.46, 0.9, 1],
          metallicFactor: 0,
          roughnessFactor: 0.65,
        },
      },
    ],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: vertexBytes, target: 34962 },
      {
        buffer: 0,
        byteOffset: vertexBytes,
        byteLength: vertexBytes,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: vertexBytes * 2,
        byteLength: indices.length * 2,
        target: 34963,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
        min: [-1, -1, -1],
        max: [1, 1, 1],
      },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: "VEC3" },
      {
        bufferView: 2,
        componentType: 5123,
        count: indices.length,
        type: "SCALAR",
      },
    ],
  };
  const json = Buffer.from(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const glb = Buffer.alloc(12 + 8 + jsonLength + 8 + binary.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonLength, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  glb.fill(0x20, 20, 20 + jsonLength);
  json.copy(glb, 20);
  glb.writeUInt32LE(binary.length, 20 + jsonLength);
  glb.writeUInt32LE(0x004e4942, 24 + jsonLength);
  binary.copy(glb, 28 + jsonLength);
  return glb;
}
