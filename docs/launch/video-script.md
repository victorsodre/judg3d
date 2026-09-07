# Short demonstration script

Target: approximately 60 seconds, 16:9, English captions. Use real app capture
and the [repair-loop example](../../examples/repair-loop/README.md). No fabricated
report, automatic repair animation or claim of an independent user.

| Time    | Picture                                                     | Narration or caption                                                                                           |
| ------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 0–8 s   | Upload `before.glb`; show the selected profile.             | “This GLB is valid, but its export has more triangles than this pipeline allows.”                              |
| 8–20 s  | Run the check; show FAIL and `TRIANGLES_OVER_BUDGET`.       | “judg3d reports 3,072 triangles against a 1,000-triangle budget, with an actionable diagnostic.”               |
| 20–32 s | Keep the report visible; show the profile and asset hashes. | “The profile is the acceptance policy. It stays unchanged.”                                                    |
| 32–43 s | Upload `after.glb`.                                         | “The authoring script removes redundant subdivisions from the six planar faces. judg3d checks the new export.” |
| 43–53 s | Run the check; show PASS and 12 triangles.                  | “Twelve triangles. The same profile passes the corrected asset.”                                               |
| 53–60 s | Show coverage and repository address.                       | “Local CLI, UI and MCP. SCHEMA and PROFILE today. Try judg3d with an asset from your own pipeline.”            |

Use short captions with enough time to read the numbers. The downloadable JSON
contains the complete report. The demo does not establish visual quality or
benchmark rendering performance. Describe it as an original procedural example.

Suggested title: **A repeatable acceptance check for GLB assets — judg3d**.

Suggested thumbnail text: **Same profile. Corrected asset.**

The repository is MIT-licensed. The generated box is original project material;
no third-party media or voice is required for this recording.
