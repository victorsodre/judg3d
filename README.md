# judg3d

[![CI](https://github.com/victorsodre/judg3d/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/victorsodre/judg3d/actions/workflows/ci.yml)

Local acceptance checks for glTF/GLB assets. An asset and a versioned profile
produce a verdict with actionable violations, metrics, hashes and explicit
coverage. Format validation uses the official
[Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator).

Reusable **[GitHub Action](.github/actions/judg3d-gate/README.md)** on `main` ·
[copy-paste workflow](examples/github-action/README.md) ·
[tester guide](docs/launch/tester-guide.md)

**0.2.0** is this source (CLI, MCP, local app, `compare`).
**[0.1.0](https://www.npmjs.com/package/judg3d)** is the last published npm set
(`app` and `judge`). The historical `judg3d@0.0.1` package was a name
reservation only. This page does not claim stars, downloads or adoption.

## Three commands

Requires Node **22.13.0 or later**. No OpenAI account or API key is needed.

```sh
npx --yes judg3d@0.2.0 app
npx --yes judg3d@0.2.0 judge model.glb -p web-commerce
npx --yes judg3d@0.2.0 compare before.glb after.glb -p profile.json
```

Until 0.2.0 is on npm, run the same commands from a source checkout
(`pnpm build && pnpm judg3d …`) or use `judg3d@0.1.0` for `app` and `judge`.
`compare` exists only in this 0.2.0 source.

Open the local address printed by `app`. Your asset is processed on your
computer.

### From source

Use pnpm **11.22.0** to build the repository and run its examples:

```sh
git clone https://github.com/victorsodre/judg3d.git
cd judg3d
pnpm install --frozen-lockfile
pnpm build
pnpm judg3d app
pnpm judg3d judge fixtures/valido.glb --profile profiles/web-commerce.json
pnpm judg3d compare fixtures/valido.glb fixtures/quebrado.glb \
  --profile profiles/web-commerce.json
```

The app prints its local address, defaulting to `http://127.0.0.1:8787`.
Choose an asset and profile, then run the analysis. Results show coverage,
searchable violations and a downloadable report. Changing the asset or profile
clears the previous result. Press `Ctrl+C` to stop the server.

## FAILED → PASSED triangle budget

A format-valid box with 3,072 triangles fails a 1,000-triangle budget. The
corrected export has 12 triangles and passes the **same** profile.

```sh
pnpm demo:repair
pnpm judg3d compare artifacts/repair-loop/before.glb artifacts/repair-loop/after.glb \
  -p examples/repair-loop/profile.json
```

`compare` prints `FAILED → PASSED`, `3072 → 12` triangles, and
`TRIANGLES_OVER_BUDGET` as removed. Exit **1** is expected: the before asset
failed. Exit 0 would mean both assets passed. Exit 2 is infrastructure
(including two different profile hashes). PASS still covers SCHEMA and PROFILE
only; skipped layers are not visual or geometric approval. See the
[repair-loop example](examples/repair-loop/README.md).

`pnpm demo` is the shorter gate: the same Box fails a four-triangle budget, a
broken asset returns diagnostics, and a missing profile is infrastructure
without a verdict. See the [reproduction guide](examples/acceptance-gate/README.md)
and [case study](docs/case-study.md).

The local interface shows exactly which checks ran:

![English interface showing a rejected sample asset, explicit coverage and actionable diagnostics](docs/assets/judg3d.png)

## Language

The interface, CLI, API, MCP and generated reports use English. The interface
does not offer a language selector or store a language preference.
User-supplied filenames and profile values are preserved as supplied.

## CLI and automation

```sh
# Atomic report write that protects the input files.
pnpm judg3d judge model.glb -p profiles/agent-loop.json -o result.json

# JSON on stdout without creating a report file.
pnpm judg3d judge model.glb -p profiles/agent-loop.json --out -

# Before/after diff against the same profile bytes.
pnpm judg3d compare before.glb after.glb -p profiles/agent-loop.json -o compare-report.json

# Runtime information and installed profile directory.
pnpm judg3d engine
pnpm judg3d profiles
```

| Exit | `judge` | `compare`                                                          |
| ---- | ------- | ------------------------------------------------------------------ |
| 0    | Passed  | Both assets passed the checks that ran                             |
| 1    | Failed  | At least one asset failed; the compare document was still written  |
| 2    | Infra   | Configuration, I/O or processing failed; no new document           |

Check the exit code before consuming a report file. An infrastructure failure
preserves any existing report, which belongs to an earlier run. `--out -` is
useful for pipelines that do not need persistent files. Human-readable output
shows up to 200 occurrences and points to the full JSON for the remainder.
`--json` prints the same JSON written to disk; `--timestamp` adds an optional date.
With timestamps disabled, identical inputs, paths and runtime produce
byte-identical reports.

### GitHub Action

A composite action runs the same CLI through `npx` and fails the job when an
asset is rejected (exit 1). Exit 2 is a hard error, not an asset verdict.

```yaml
- uses: victorsodre/judg3d/.github/actions/judg3d-gate@main
  with:
    assets: assets/product.glb
    profile: web-commerce
    version: "0.1.0"
```

Copy the [example workflow](examples/github-action/README.md), pin the action
to a commit SHA, and replace the asset paths. Bundled names `web-commerce` and
`agent-loop` resolve through `judg3d profiles`. Copy a profile when you need
your own budgets. This repository exercises pass and fail fixtures in
[.github/workflows/judg3d-gate.yml](.github/workflows/judg3d-gate.yml).

## Coverage and profiles

| Layer                      | Available checks                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------ |
| SCHEMA                     | glTF 2.0 conformance through Khronos                                                 |
| PROFILE                    | Triangle, vertex, material, draw-call and image-resolution budgets; self-containment |
| GEOMETRY, VISUAL, SEMANTIC | Unavailable; enabling them returns exit 2                                            |

PASS applies to `coverage.ran`; it does not certify appearance or visual fitness.
`coverage.skipped` lists checks that did not run. External glTF resources are
never fetched or read. Set PROFILE `requireSelfContained: true` to require a
portable file with embedded resources.

`web-commerce` enables SCHEMA only; its name does not imply universal commerce
budgets. `agent-loop` enables SCHEMA and PROFILE with limits from a specific
pipeline. Copy it and choose limits for your project. See
[profiles/README.md](profiles/README.md).

`failOn` determines rejection. `report` controls verbosity without changing the
verdict or hiding the severity that caused rejection. Information and Hint retain
their original Khronos severity in `got.severity`; the contract presents them as
`warn`, but they do not cause rejection on their own. `maxPerCode` summarizes
occurrences after validation. A truncated validation caused by `maxIssues`
returns infrastructure failure. Disabling all layers, requesting inheritance
through `extends`, or enabling PROFILE without SCHEMA also returns exit 2.

## MCP for agents

The MCP server exposes `judge_asset` and, in this repository, `compare_assets`
for reading local files. Configure the published CLI and restrict the workspace
to your project:

```json
{
  "mcpServers": {
    "judg3d": {
      "command": "npx",
      "args": ["--yes", "judg3d@0.2.0", "mcp", "--root", "/path/to/project"]
    }
  }
}
```

Tool arguments for `judge_asset`:

```json
{ "asset": "assets/product.glb", "profile": "profiles/product.json" }
```

`compare_assets` takes `{ "before", "after", "profile" }`. Both sides must use
the same profile bytes. The compare document records verdicts, metric deltas,
violations added/removed/unchanged by code, and a coverage note. Differing
coverage never turns an unperformed layer into PASS.

Both paths, including symlink targets, must remain inside the workspace. The
tools do not write reports or access URLs. They return `structuredContent` with
`ok`, `exitHint` and either `report` or `compare`. Asset rejection is a normal
result (`exitHint: 1`); infrastructure failures use `isError: true` and
`exitHint: 2`. Stdout is reserved for the protocol.

`judg3d@0.1.0` on npm includes `judge_asset` only. This 0.2.0 source adds
`compare` / `compare_assets`. Use the repository until 0.2.0 is published.

## Limits and privacy

CLI, MCP and HTTP analysis use workers with a 30-second deadline and a V8 old
generation limit of 256 MiB per analysis; this is not a total RSS cap. Assets
are limited to 64 MiB and profiles to 1 MiB. MCP and HTTP allow at most two
concurrent analyses. Exceeding processing limits returns infrastructure failure.

The app binds to `127.0.0.1`, validates hostname and origin, blocks framing,
and prevents static-file access to dotfiles and symlinks outside its root.
There is no telemetry, remote upload or external font request. Uploads are
processed in memory; reports are written only by the CLI or an explicit download.
Configure the app with `--port` and `--profiles`. For development:

```sh
pnpm app:dev
# UI :5173 and API :8787, with local development origins allowed.
```

The HTTP API is local, without hosted accounts or authentication.
`@judg3d/judge` also exports an in-process `judge()` without worker isolation;
applications processing untrusted assets should use `judgeIsolated()`.

## Verification and release

```sh
pnpm typecheck && pnpm lint && pnpm test
pnpm docs:check
pnpm release:pack
pnpm release:check
```

Packing creates five tarballs and a SHA-256 manifest in `artifacts/release/`.
The check installs them in a clean temporary directory and verifies CLI exit
codes, determinism, MCP over stdio, HTTP UI and uploaded asset analysis. It does
not publish to npm or change GitHub. CI is configured for Node 22.13, 24 and 26.

| Package         | Responsibility                                             |
| --------------- | ---------------------------------------------------------- |
| `@judg3d/core`  | Contracts, profiles, serialization and shared presentation |
| `@judg3d/judge` | SCHEMA/PROFILE layers and isolated execution               |
| `@judg3d/app`   | Local API and interface with bundled profiles              |
| `@judg3d/mcp`   | MCP protocol and workspace restriction                     |
| `judg3d`        | CLI entry points                                           |

Product decisions: [specification](docs/judg3d-spec-v0.md).
Published 0.1.0 notes: [docs/release-0.1.0.md](docs/release-0.1.0.md).
Contributor conventions: [AGENTS.md](AGENTS.md).
Historical specification and calibration notes are in Portuguese.

## Contribute and integrate

Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [architecture](docs/architecture.md)
and [agent integration guide](docs/agent-integration.md). Useful contributions
include reproducible edge cases, downstream integration feedback and onboarding
improvements. See the [roadmap](ROADMAP.md), [security policy](SECURITY.md),
[support](SUPPORT.md) and [governance](GOVERNANCE.md).

Trying judg3d for the first time? Start with the [tester guide](docs/launch/tester-guide.md).

## License

[MIT](LICENSE) for judg3d's original source and documentation.
Dependencies and sample assets retain their own licenses; see
[third-party notices](THIRD_PARTY_NOTICES.md) and
[fixture attribution](fixtures/README.md). Sample assets are excluded from npm packages.
