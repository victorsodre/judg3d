# Roadmap

This roadmap describes concrete next steps, not promised dates. The current
source is 0.2.0: SCHEMA and PROFILE through CLI, local HTTP/UI, MCP,
`judg3d compare`, and a reusable GitHub Action.

## Done

- Public MIT source, CI required for merges, private vulnerability reporting.
- npm 0.1.0: CLI, local HTTP/UI and MCP with SCHEMA/PROFILE coverage.
- Reproducible format failure, budget failure and infrastructure failure, with
  hashes and explicit coverage.
- `judg3d compare` diffs two independent judge runs that share profile bytes.
  A profile-hash mismatch is infrastructure failure. Coverage notes list
  skipped layers so a baseline cannot turn an unperformed check into PASS.
- Reusable GitHub Action (`judg3d-gate`) and a copy-paste workflow that fail a
  PR on asset rejection. Other CI hosts can reuse the same CLI exits.

## Next: independent trials

- Invite independent users to reproduce `pnpm demo:repair` + `compare` and to
  try the Action on a real repository. Record public feedback with permission.
- Validate the documented setup in downstream projects using glTF/GLB assets.
- Do not claim adoption from maintainer demos, synthetic test runs or package
  reservation downloads.

## Still open

- Expand fixtures for real exporter and validator edge cases, with
  redistribution rights, source versions and checksums recorded.
- Further comparison work (recurrence counting across a series of reports,
  visual baselines) still needs its own specification.
- Geometry, rendering, baselines and semantic review need separate
  specifications, validated dependencies and evidence. Do not advertise them
  as implemented. Before adding visual judgments, define repeatable
  camera/rasterizer settings, observable limitations and profile-controlled
  thresholds.

Useful first contributions include minimal reproductions, testing the clean
installation on another OS and improving onboarding. Open an issue to
coordinate work before building a large feature.
