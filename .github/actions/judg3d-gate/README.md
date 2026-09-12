# judg3d-gate

Composite GitHub Action that runs `judg3d judge` and fails the job when an
asset is rejected. Consumers do not need this monorepo: the default path is
`npx --yes judg3d@<version>`.

Exit codes are the CLI contract. The action does not change verdict semantics.

| Exit | Meaning | Action |
| ---- | ------- | ------ |
| 0 | Asset passed the checks performed | Step succeeds |
| 1 | Asset failed; a report describes the violations | Step fails (`fail-on: rejected`) |
| 2 | Configuration, I/O or processing failed; no new verdict | Step fails as a hard error |

`failOn` in the profile still decides whether a diagnostic rejects the asset.
The action `fail-on` input only controls whether CLI exit 1 fails the GitHub step.

## Usage

```yaml
- uses: victorsodre/judg3d/.github/actions/judg3d-gate@main
  with:
    assets: assets/product.glb
    profile: web-commerce
    version: "0.1.0"
```

Pin the action to a commit SHA after you have tried it. A copy-paste workflow
is in [examples/github-action](../../../examples/github-action/README.md).

`profile` may be a JSON file in the caller repository or a bundled name
(`web-commerce`, `agent-loop`). Bundled names are resolved with
`judg3d profiles` after `npx` installs the package. Copy a profile from
[profiles/](../../../profiles/) when you need your own budgets.

On rejection or infrastructure failure the JSON report is appended to the job
summary and, by default, uploaded as an artifact.
