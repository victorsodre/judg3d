# Fail a pull request when a glTF/GLB exceeds a profile

This example shows how another repository can call the
[judg3d-gate](../../.github/actions/judg3d-gate/README.md) composite action
in about five minutes. The action runs the published `judg3d` CLI through
`npx`. It does not require a pnpm checkout of this monorepo.

## 1. Choose a profile

Copy [profiles/web-commerce.json](../../profiles/web-commerce.json) or
[profiles/agent-loop.json](../../profiles/agent-loop.json) into your repository
and edit the budgets, or pass a bundled name (`web-commerce`, `agent-loop`).
`web-commerce` enables SCHEMA only. Enable PROFILE and set limits that match
your pipeline; do not treat the sample numbers as universal defaults.
See [profiles/README.md](../../profiles/README.md).

## 2. Point the workflow at your assets

Copy [judg3d-gate.yml](judg3d-gate.yml) to `.github/workflows/judg3d-gate.yml`
in your repository and replace the asset paths. Paths may be listed or given
as globs (`assets/**/*.glb`).

This repository's [fixtures](../../fixtures/README.md) are Khronos/Cesium
samples used to demonstrate pass and fail. If you copy a fixture, keep its
license attribution.

## 3. Pin versions

The sample workflow uses `judg3d@0.1.0` and the action on `main` so a first
trial is copy-pasteable. Pin both the action (commit SHA or tag) and the npm
package version before you rely on the gate.

## What success and failure look like

| Case | Inputs | Expected step |
| ---- | ------ | ------------- |
| Valid asset | `fixtures/valido.glb` + `web-commerce` | Exit 0, step passes |
| Format failure | `fixtures/quebrado.glb` + `web-commerce` | Exit 1, step fails, report in the job summary |
| Budget failure | `fixtures/valido.glb` + `examples/acceptance-gate/budget.json` | Exit 1, `TRIANGLES_OVER_BUDGET` |
| Missing profile | any asset + a path that does not exist | Exit 2, hard error, no new verdict |

This repository runs those pass and fail cases in
[.github/workflows/judg3d-gate.yml](../../.github/workflows/judg3d-gate.yml).

PASS covers `coverage.ran` only. SCHEMA and PROFILE do not certify appearance.

## Local check of the action script

From the repository root, after `pnpm build`:

```sh
node examples/github-action/run.mjs
```

The script exercises the same runner the Action uses, against the local CLI
and the fixtures above.
