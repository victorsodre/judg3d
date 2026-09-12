# Changelog

## 0.2.0 — 2026-09-12

Source prepared for the next npm publication. **0.1.0 remains the last
registry release** until these packages are published.

### Headline features

- **Reusable GitHub Action.** `judg3d-gate` and a copy-paste workflow fail a
  job when `judg3d judge` rejects a glTF/GLB (exit 1) and treat exit 2 as
  infrastructure. Profile `failOn` still owns the verdict. The Action pins
  the published `judg3d@0.1.0` CLI until 0.2.0 is on npm.
- **`judg3d compare`.** Judges two assets against the same profile bytes and
  writes a before/after document (verdicts, metric deltas, violations by
  code, coverage/runtime notes). Exit 0 only when both pass; exit 1 when
  either fails; exit 2 for infrastructure, including mismatched profile
  hashes. Unperformed layers are never treated as PASS. MCP exposes the same
  comparison as `compare_assets`. The repair-loop demo (`pnpm demo:repair`)
  shows `FAILED → PASSED` and `3072 → 12` triangles.

Geometry, rendering, baselines, inheritance and semantic judgments are not
implemented. This entry does not claim independent adoption.

## 0.1.0 — 2026-09-07

First usable release for local glTF/GLB acceptance checks, published on npm.

- SCHEMA via Khronos and PROFILE budgets/self-containment, with explicit coverage.
- CLI, isolated worker execution, local HTTP/UI and MCP over stdio.
- Stable exit codes: accepted asset 0, rejected asset 1, infrastructure failure 2.
- Atomic reports, input protection, bounded reads/processing and cancellation.
- Workspace-restricted MCP, local-origin validation and static-file boundaries.
- English interface, diagnostics and canonical reports.
- Rejection of contradictory received reports and bounded nested presentation.
- MIT license, bundled third-party notices, contributor/security policies and
  reproducible acceptance-gate demonstration.
- A reproducible authoring correction demo with unchanged profile rules,
  first-user trial materials and package verification against the npm registry.
- Clean-install verification for all five packages; CI and dependency updates.

Geometry, rendering, baselines, inheritance and semantic judgments are not
implemented.

### Compatibility notes

Earlier unpublished snapshots used `got.uso` and `got.omitidas`; this release
uses `got.usage` and `got.omitted`. Diagnostic codes and profile acceptance rules
are preserved. `aplicarTetoPorCodigo` remains a compatibility alias for
`capIssuesPerCode`. UI API failures now include stable error codes for localization.

## 0.0.1 — 2026-08-20

Historical npm name reservation only; not a functional asset validator.
The archived package lives under `tools/npm-placeholder/` and is not a release path.
