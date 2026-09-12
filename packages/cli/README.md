# judg3d

Local CLI for accepting or rejecting glTF/GLB assets against a versioned profile.
Help, diagnostics and generated reports are in English.

```sh
judg3d judge model.glb --profile profile.json --out result.json
judg3d compare before.glb after.glb --profile profile.json --out compare-report.json
judg3d app
judg3d mcp --root /path/to/project
judg3d profiles
```

`judge` exit 0: passed. Exit 1: failed. Exit 2: infrastructure failure without a new verdict.
`compare` exit 0: both assets passed. Exit 1: at least one failed (document still written).
Exit 2: infrastructure failure, including two different profile hashes.
A reusable GitHub Action wraps this command; see the
[repository README](../../README.md#github-action).
`--out -` prints JSON only. The app runs at http://127.0.0.1:8787 and uses English.
SCHEMA and PROFILE are available; geometry, appearance and semantics are not evaluated.
Assets up to 64 MiB, profiles up to 1 MiB, analyses up to 30 seconds.

MIT-licensed. Requires Node 22.13.0 or later.
