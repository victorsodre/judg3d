# judg3d

Local CLI for accepting or rejecting glTF/GLB assets against a versioned profile.
Help, diagnostics and generated reports are in English.

```sh
judg3d judge model.glb --profile profile.json --out result.json
judg3d app
judg3d mcp --root /path/to/project
judg3d profiles
```

Exit 0: passed. Exit 1: failed. Exit 2: infrastructure failure without a new verdict.
`--out -` prints JSON only. The app runs at http://127.0.0.1:8787 and offers
English by default with a persistent Português (Brasil) interface option.
SCHEMA and PROFILE are available; geometry, appearance and semantics are not evaluated.
Assets up to 64 MiB, profiles up to 1 MiB, analyses up to 30 seconds.

Version 0.1.0 is prepared for review; MIT-licensed; publication remains pending.
