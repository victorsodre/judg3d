# Release 0.1.0

Published on npm on 2026-09-07. This release provides a local CLI, MCP server and browser app over the same
SCHEMA/PROFILE engine. All five packages use MIT and include the license and
third-party notices. Source is public on GitHub. The old `judg3d@0.0.1` package only reserved the npm name.

Start with `npx --yes judg3d@0.1.0 app`. The published package set is
`judg3d`, `@judg3d/core`, `@judg3d/judge`, `@judg3d/app` and `@judg3d/mcp`,
all at 0.1.0. A clean registry installation matched the reviewed tarballs and
passed CLI exit-code, determinism, MCP and HTTP/UI checks on Node 26.7.0.
The same tarballs also passed installation checks on Node 22.13.0.

## Resulting behavior

- Profiles with no checks, unimplemented inheritance or PROFILE without SCHEMA
  return infrastructure failure. Requested unavailable layers never silently pass.
- Original Khronos severity determines rejection. Report filtering and per-code
  summarization preserve the verdict. Interrupted validation returns exit 2.
- Internal validator errors and unmeasurable budgeted textures are handled
  explicitly. Optional measurements remain absent when unavailable.
- CLI reports are atomic, protect input files and support stdout-only JSON.
  Human summaries are bounded and terminal controls are escaped.
- CLI, API and MCP share worker isolation, timeout and cancellation. MCP restricts
  local paths to its chosen root and uses the official SDK over stdio.
- HTTP validates local origins/hostnames and restricts static files. The app
  supports reconnect/cancel, resets results when inputs change, shows coverage
  and filters/paginates violations.
- The interface, report JSON and technical diagnostics use English.
  The UI has no language selector or stored language preference.
- Received reports reject inconsistent coverage and contradictory verdicts.
  Nested detail formatting is bounded without changing raw report data.
- MIT licensing, contribution/security/governance documents, issue/PR templates,
  dependency updates and reproducible demonstration support public maintenance.

## Reproduce verification

```sh
pnpm typecheck && pnpm lint && pnpm test
pnpm docs:check
pnpm demo
pnpm release:pack
pnpm release:check
node tools/check-release.mjs --registry
```

Tests cover valid/broken assets, configuration errors, verdict invariants,
report integrity, input protection, cancellation, large diagnostics, HTTP
boundaries and real MCP transport. The package check installs all tarballs
outside the monorepo, verifies hashes/licenses and exercises CLI exits,
determinism, MCP, HTTP UI and asset upload. Temporary installations are removed.

`artifacts/demo/manifest.json` records reproducible demo inputs and report hashes.
`artifacts/release/manifest.json` records package hashes; verification files must
match them. Screenshots in `output/playwright/` document real browser checks.
Fixtures retain their original bytes and attribution.

CI is configured for Linux with Node 22.13/24/26 and macOS with Node 26. A separate
job scans full Git history using a pinned, checksum-verified Gitleaks binary.
The initial public candidate passed [all four CI environments](https://github.com/victorsodre/judg3d/actions/runs/34081809801)
and the [history secret scan](https://github.com/victorsodre/judg3d/actions/runs/34081809768).
Those runs identify their exact source revision. Check the latest main-branch
run before a subsequent release; earlier results do not verify later changes.

The English-only launch and repair example passed the
[four-environment CI matrix](https://github.com/victorsodre/judg3d/actions/runs/34085605486)
and [history secret scan](https://github.com/victorsodre/judg3d/actions/runs/34085605430)
before [PR #6](https://github.com/victorsodre/judg3d/pull/6) was merged.

## Limits and next steps

SCHEMA/PROFILE do not certify appearance, geometry, UVs or semantics. Baselines,
rendering, inheritance, remote assets and hosted accounts are unavailable.
`web-commerce` enables SCHEMA only; `agent-loop` contains example pipeline limits.
Worker memory limits are not a total RSS cap or an OS security sandbox.

Follow the [release checklist](maintainers/release.md) for historical privacy
review, public source, private vulnerability reporting, exact tarball publication
and rollback. See [CHANGELOG.md](../CHANGELOG.md) for compatibility notes.
The [program preparation record](maintainers/openai-application.md) keeps
technical evidence separate from unproven adoption claims.
