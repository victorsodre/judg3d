# AGENTS.md — judg3d

Deterministic acceptance judge for 3D assets. The source of truth is
`docs/judg3d-spec-v0.md`; this file explains how to work in the repository.

## Commands

```bash
pnpm install
pnpm build          # tsc --build (core -> judge -> cli)
pnpm typecheck      # tsc --build --force + the test project
pnpm lint           # type-aware eslint
pnpm test           # build + vitest run
pnpm judg3d judge <asset> --profile profiles/web-commerce.json
pnpm fixtures:fetch # re-download Khronos GLBs and verify sha256
```

## Non-negotiable specification invariants

1. **Determinism.** Equal `(assetHash, profileHash, engineVersion)` values
   produce the same verdict and rasters. Do not let `Date.now()`,
   `Math.random()`, or `Set`/`Map` iteration order leak into a report.
   `judge-report.json` has no timestamp by default so it remains byte
   deterministic.
2. **The profile owns tolerance.** No number that decides acceptance may be
   hardcoded. If a judge limit is written in code, it is in the wrong place.
3. **Infrastructure failure is not rejection.** Exit 0 is accepted, 1 is
   rejected, and 2 is infrastructure. The only unacceptable result is a PASS
   that actually means “this check did not run.” An enabled, unimplemented
   layer returns exit 2; a non-glTF file returns exit 1 (SCHEMA rejection),
   never 2.
4. **Every violation is actionable.** It needs a stable code, a location
   (`nodePath`), and `got`/`want`. A violation without a location helps neither
   an agent nor a person.

## Layers

| Layer | Status | Location |
|-------|--------|----------|
| L1 SCHEMA | ready | `packages/judge/src/layers/l1-schema.ts` |
| L2 PROFILE | ready (budgets + self-containment) | `packages/judge/src/layers/l2-profile.ts` |
| L3 GEOMETRY | not implemented | — |
| L4 VISUAL | not implemented | — |
| L5 SEMANTIC | not implemented | — |

Implementing a layer means creating `layers/lN-*.ts`, connecting it in
`judge.ts`, and adding it to `IMPLEMENTED_LAYERS` in
`packages/core/src/profile.ts`. Until it is in that list, enabling it in a
profile makes the command exit 2. That is intentional.

## Rules

- **Complete code.** No `TODO`, no stub that returns a fabricated value, and no
  function that pretends to measure. A field that no layer computes is absent
  from the report (`MeshMetrics.dimensions`); it is not set to zero.
- **Gate before every delivery:** `pnpm typecheck && pnpm lint && pnpm test`.
  All three must pass, including for a small change.
- **Exact dependency versions** (`.npmrc` has `save-exact=true`) need a
  one-line PR justification. Add a dependency only when it removes real work;
  use proven Khronos runtime components rather than recreating them.
- **Fixtures are immutable.** Never edit a file under `fixtures/` in place. A
  new case is a new file with provenance and sha256 in `fixtures/README.md`.
- **Shared presentation belongs in `packages/core/src/present.ts`.** It is the
  **only** core module without `node:`, published at `@judg3d/core/present` so
  the browser can import its values. Size formatting, shortened hashes, and a
  violation’s `got`/`want` line come from it; the CLI and local app import them
  rather than copy them. If a function needs `node:`, it does not belong in
  that file. Types may come from the root through `import type`, which the
  compiler removes.
- **Do not reimplement what Khronos already provides.** The validator, format
  parser, and renderer are not our code. The value is in profile-as-code and
  in the report an agent reads.
- **Never invent a contract field.** `Verdict`, `Violation`, `MeshMetrics`,
  and `AnnotatedRender` transcribe the specification. New metadata belongs in
  the `JudgeReport` envelope, not inside `Verdict`. A new contract field first
  requires a specification change and supporting evidence; that is how
  `MeshMetrics.textures` was added (see `docs/calibracao-tumbler.md`).
- **Language:** English is used in the product, public documentation, code, and
  outputs (CLI, API, MCP, and JSON). The UI is English-only.
- Use small conventional commits, one coherent stage at a time.

## Definition of done

- `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass.
- `fixtures/valido.glb` and `fixtures/valido-textura.glb` pass with exit 0.
- `fixtures/quebrado.glb` is rejected with exit 1 and readable violations.
- `judge-report.json` conforms to the contract and is identical across two
  executions.
- New behavior has a test. A new acceptance rule has a profile key.
