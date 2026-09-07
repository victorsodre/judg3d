# Repair an asset without changing its acceptance policy

```sh
pnpm demo:repair
```

This example runs the real CLI against two original, procedurally generated GLB
exports of a box. The first export has redundant subdivisions on its six planar
faces. The authoring script regenerates those faces with a single quad per face.
judg3d checks each export against the **same profile**.

| Export       | Triangles | Budget | Result                        |
| ------------ | --------: | -----: | ----------------------------- |
| `before.glb` |     3,072 |  1,000 | FAIL: `TRIANGLES_OVER_BUDGET` |
| `after.glb`  |        12 |  1,000 | PASS                          |

The script verifies the measured counts, diagnostic, executed layers, unchanged
profile hash and byte-identical reports across repeated runs. The input hashes
must differ. Files and evidence are written to `artifacts/repair-loop/`.

The mesh generation is deliberately bounded to these two examples. This is an
authoring correction, not a mesh optimization feature in judg3d. The box is an
educational example, not independent usage evidence. The 1,000-triangle budget
is illustrative; choose a budget that fits your pipeline. PASS covers SCHEMA and
PROFILE only and does not establish visual or geometric quality.

## Try the same files in the app

After running the example:

```sh
pnpm judg3d app --profiles examples/repair-loop
```

1. Upload `artifacts/repair-loop/before.glb` and choose **Judge asset**.
2. Inspect the budget violation and SCHEMA/PROFILE coverage.
3. Upload `artifacts/repair-loop/after.glb` and judge it again.
4. Compare the downloadable reports: the asset changed, the profile did not.

The geometry and generator are original MIT-licensed project material. Existing
Khronos fixtures remain unchanged. See the [short video script](../../docs/launch/video-script.md)
and [tester guide](../../docs/launch/tester-guide.md).
