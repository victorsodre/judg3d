# Changelog

## 0.1.0 — unreleased

First usable release candidate for local glTF/GLB acceptance checks.

- SCHEMA via Khronos and PROFILE budgets/self-containment, with explicit coverage.
- CLI, isolated worker execution, local HTTP/UI and MCP over stdio.
- Stable exit codes: accepted asset 0, rejected asset 1, infrastructure failure 2.
- Atomic reports, input protection, bounded reads/processing and cancellation.
- Workspace-restricted MCP, local-origin validation and static-file boundaries.
- English-first interface with persistent pt-BR option; canonical reports in English.
- Rejection of contradictory received reports and bounded nested presentation.
- MIT license, bundled third-party notices, contributor/security policies and
  reproducible acceptance-gate demonstration.
- Clean-install verification for all five packages; CI and dependency updates.

Geometry, rendering, baselines, inheritance and semantic judgments are not
implemented. The candidate has not yet been published to npm.

### Compatibility notes

Earlier unpublished snapshots used `got.uso` and `got.omitidas`; the candidate
uses `got.usage` and `got.omitted`. Diagnostic codes and profile acceptance rules
are preserved. `aplicarTetoPorCodigo` remains a compatibility alias for
`capIssuesPerCode`. UI API failures now include stable error codes for localization.

## 0.0.1 — 2026-08-20

Historical npm name reservation only; not a functional asset validator.
The archived package lives under `tools/npm-placeholder/` and is not a release path.
