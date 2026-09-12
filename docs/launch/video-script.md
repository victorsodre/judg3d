# Short demonstration script

Target: approximately 45 seconds, 16:9, English captions. Use real CLI or app
capture and the [repair-loop example](../../examples/repair-loop/README.md).
No fabricated report, automatic repair animation or claim of an independent user.

| Time    | Picture                                                     | Narration or caption                                                                                         |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 0–6 s   | Upload or show `before.glb` and the unchanged profile.      | “This GLB is valid, but the export has more triangles than this pipeline allows.”                            |
| 6–16 s  | Judge; show FAIL and `TRIANGLES_OVER_BUDGET` (3,072 / 1,000). | “judg3d reports 3,072 triangles against a 1,000-triangle budget.”                                          |
| 16–28 s | Run `judg3d compare before.glb after.glb -p profile.json`.  | “The authoring script rebuilds the six faces. `compare` judges both exports against the same profile bytes.” |
| 28–38 s | Human summary: `FAILED → PASSED`, `3072 → 12`.              | “FAILED to PASSED. 3,072 to 12 triangles. The budget violation is gone.”                                     |
| 38–45 s | Repository address and the GitHub Action snippet.           | “Local CLI, UI, MCP, and a reusable GitHub Action. Try one asset from your own pipeline.”                    |

Use short captions with enough time to read the numbers. The downloadable JSON
contains the complete report. Exit 1 on this pair is expected because the
before asset failed. The demo does not establish visual quality or benchmark
rendering performance. Describe it as an original procedural example.

Suggested title: **A repeatable acceptance check for GLB assets — judg3d**.

Suggested thumbnail text: **FAILED → PASSED. Same profile.**

The repository is MIT-licensed. The generated box is original project material;
no third-party media or voice is required for this recording.
