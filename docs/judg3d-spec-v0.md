---
tags: [project/judg3d, specification]
updated: 2026-08-20
---

# judg3d — specification v0

## Unit and primitive

`Verdict = judge(asset | scene, profile, baseline?)` is a pure, deterministic
function. The equivalent of a frame is a **view**: numbered, addressable fixed
camera renders that can be compared against a baseline.

## v0 inputs

1. A glTF/GLB file: covers generated output (Tripo, Meshy, and Hunyuan export
   GLB) and exports from any DCC.
2. A live three.js/R3F scene: an injected script runs `GLTFExporter` at runtime
   to produce a canonical GLB, then uses the same pipeline. This makes any
   three.js application judgeable without a plugin.

USD, Unreal Engine, and Unity are outside v0. They may enter through export in
the future, not through an engine integration.

## Borrowed runtime components (what not to write)

- Khronos glTF Validator and Asset Auditor (3D Commerce Audit Profiles as
  factory profiles).
- Headless three.js with a pinned software rasterizer (SwiftShader/llvmpipe);
  optional headless Blender for material verification renders.
- Do not write a renderer, format parser, retopology, or repair tool.

## Profile-as-code

A `profile.json` versioned in the customer repository inherits and extends a
Khronos Audit Profile: polygon-count, draw-call, and texture budgets; expected
scale with tolerance; pivot/origin; naming; required compression (Draco/KTX2);
and file-size limits. What is correct for e-commerce is not correct for film.
The pipeline owner defines it in code, with a diff and review. All defensible
value lives there and in the report an agent reads.

## The layered judge

- L1 SCHEMA — Validator: valid glTF.
- L2 PROFILE — Auditor plus extensions: texel density, UVs, PBR ranges,
  budgets, and dimensions. **Partly implemented:** budgets (triangles,
  vertices, materials, draw calls, and largest texture) and self-containment
  (no resource outside the container). Texel density, UVs, and PBR ranges need
  glTF JSON that validator `info` does not expose; see
  `docs/calibracao-tumbler.md`.
- L3 GEOMETRY — custom assertions: manifold/watertight when a profile requires
  it, inverted normals, degenerate triangles, actual versus declared scale,
  pivot, empty hierarchy, and missing texture.
- L4 VISUAL — deterministic N views (a vendored neutral-light rig and fixed
  cameras) versus baseline: SSIM and pixel ratio per view, plus a profile mask
  and threshold.
- L5 SEMANTIC (optional; never a gate by itself) — a VLM with a narrow rubric,
  low weight, and a deterministic explanation alongside it.

## Contract (TypeScript)

```ts
export type Verdict = {
  pass: boolean;
  violations: Violation[];
  views: AnnotatedRender[];   // stills with bounding boxes — what the agent reads
  metrics: MeshMetrics;       // tris, materials, draw calls, textures, dimensions, estimated VRAM
};

// MeshMetrics.textures?: { count, maxSize }  — added on 2026-08-22.
// Reason and evidence: in a 78-round calibration against an agent-led authoring
// pipeline, the change that altered the image most produced two IDENTICAL rows
// in the metrics series. Counting materials says nothing about their content;
// resolution is the first measurable content attribute without parsing glTF JSON.
// Details: docs/calibracao-tumbler.md.

export type Violation = {
  kind: "SCHEMA" | "PROFILE" | "GEOMETRY" | "VISUAL" | "SEMANTIC";
  code: string;               // "UV_OVERLAP", "SCALE_MISMATCH", "VIEW_DIFF"...
  severity: "error" | "warn";
  nodePath?: string;
  view?: number;
  bbox2d?: Box;
  got: unknown;
  want: unknown;
};

// Invariants:
// 1. Determinism: equal (assetHash, profileHash, engineVersion) => equal
//    rasters and verdict. Software rasterizer is pinned.
// 2. The profile owns tolerance; it is never hardcoded.
// 3. Infrastructure failure is not rejection: distinct exit codes and no false
//    “passed” result (a lesson from three.js CI).
// 4. Every violation is actionable: code + location + got/want.
```

## Surfaces

1. **MCP server** — `judge_asset`, `judge_url`, `render_views`, and
   `approve_baseline`. It enters a Claude Code or Cursor loop.
2. **GitHub Action** — the gate: a pull request with a report and annotated
   stills; baseline approved by a human.
3. **API/farm** — batch triage: N GLBs enter; a PASS/FAIL report and metrics
   leave.
4. **Shell `npx judg3d`** — local UI: drop a GLB, a scene URL, or a BYOK chat
   generation result.

## Registry (the winning form)

This is not a gallery; Meshy Community already is one. It is an API/CLI-first
**registry**.

- An asset enters only after it passes the judge, and leaves with a verdict,
  license manifest, and hash.
- It is consumed by ID with a lockfile: an agent or developer asks for “a
  judged chair, under 5k triangles, CC-BY or more permissive,” and receives a
  pinned artifact.
- A public `judg3d ✓` mark exposes its metrics. It resists low-quality output
  by construction.
- v0 publication: upload with auto-judge (or PR-based at first, which is less
  expensive to moderate).
- Legal asset sources for the “free” catalog: (a) a generation free tier (CC
  BY 4.0, with an attribution chain in the manifest), (b) local weights, and
  (c) procedural/code assets, the cleanest option with no third-party license.

### Verified licenses (2026-08-20)

- **Meshy:** paid plan gives full private ownership of an asset (exclusivity is
  lost if it is published in the community); free plan is CC BY 4.0,
  irrevocable, and commercial with attribution (help.meshy.ai).
- **Tripo:** public models on the free tier are CC BY 4.0; paid plans grant
  broad use and monetization rights (tripo3d.ai, terms dated 2025-07-11).
- **Hunyuan3D / TRELLIS** (open weights): secondary sources indicate output may
  be used commercially with few restrictions — **UNCERTAIN**. Read the exact
  terms before making a catalog promise.
- Product implication: every asset needs a license manifest paired with its
  verdict, putting provenance and quality on the same seal.

## Trailer (first demo artifact)

Scene 1: Claude Code writes an R3F scene; judg3d rejects it with three
violations (scale 10× outside the profile, UV overlap, and missing texture),
showing annotated stills; the agent corrects it; the PR turns green. Scene 2:
a batch of 50 Hunyuan/TRELLIS GLBs is triaged with a report. One video, one
thread.

## v0 does not do

USD; animation or rigging QA; physics; automatic repair (it identifies issues,
not fixes them); an in-engine plugin; a profile marketplace; a VLM as a gate;
or sophisticated registry accounts and moderation.

# Semantics of the first usable release (0.1.0)

The shippable scope is SCHEMA + PROFILE, CLI, stdio MCP, and the local app.
GEOMETRY, VISUAL, SEMANTIC, and profile inheritance remain unavailable.
Requesting an unavailable capability, disabling every layer, or enabling
PROFILE without SCHEMA is a configuration error (exit 2), with no verdict.

`failOn` uses Khronos’s original severity after `severityOverrides`. `report`
controls presentation: it never changes acceptance or hides a failing severity.
Information and Hint retain their original severity in `got.severity`; the
contract presents them as `warn`, but they do not fail under `failOn: warn`.
The synthetic `ISSUES_TRUNCATED` warning also does not fail by itself.
`maxPerCode` summarizes a report after validation; `maxIssues` can interrupt
Khronos validation. That result is incomplete and returns infrastructure (2).
Internal validator failures are infrastructure; an unrecognized format is a
SCHEMA FAIL.

`nodePath: ""` identifies the entire document (the root JSON Pointer), while
`offset:N` identifies a byte in the container. Aggregate budget violations
point to the root. Coverage explicitly declares layers that did not run; a PASS
in this release does not certify appearance, geometry, or semantics.

When an image cannot be measured and `maxTextureSize` is set, PROFILE rejects
with `TEXTURE_METRICS_UNAVAILABLE` at the image pointer. The aggregate
`textures` metric is absent rather than zero or a partial maximum.

## Language policy

English is the product language, including the interface, CLI help, API/MCP
errors, diagnostic messages, and JSON reports. The UI uses English regardless
of browser locale or previously stored preferences. It has no language selector.
Public documentation is in English. Report detail keys use `usage` and
`omitted` instead of the Portuguese names from the unpublished candidate;
violation codes are unchanged.

## Report boundary validation

A received report must declare at least one executed layer. Engine layers and
executed coverage agree in order; executed and skipped layers are unique,
disjoint, and cover the five contract layers. A PASS cannot contain
error-severity violations, and a FAIL must contain a diagnostic. Violations
refer only to executed layers. Counters use nonnegative safe integers. Invalid
reports are rejected before presentation; these checks do not recompute asset
acceptance. Human-readable nested details use bounded traversal; the original
JSON remains complete. These are presentation and transport safeguards, not
profile tolerances.
