# Contributing to judg3d

judg3d checks glTF/GLB assets against explicit, versioned acceptance rules.
Contributions are welcome in validation, integrations, documentation and
English/Brazilian Portuguese interface translations.

## Run the project

Use Node 22.13.0 or later and pnpm 11.22.0. From a fresh checkout:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm demo
pnpm judg3d app
```

No API key, paid service or account is needed. The demo checks real fixtures
and writes reports under `artifacts/demo/`.

Before submitting a pull request:

```sh
pnpm typecheck && pnpm lint && pnpm test
pnpm docs:check
pnpm release:pack
pnpm release:check
```

The release check installs local tarballs in a temporary directory and contacts
the npm registry for dependencies. It never publishes packages. Keep fixtures
unchanged; a new fixture needs provenance, a hash and license attribution in
[fixtures/README.md](fixtures/README.md).

## Make a reviewable change

Describe the user-visible problem, the final behavior and the validation you
ran. For a bug, include a minimal reproducible asset or generate a small test
input. Do not attach proprietary assets, secrets, personal file paths or
unnecessary reports. Add regression tests for behavior that could fail again.

Acceptance thresholds belong in profiles, not hardcoded judge rules. A PASS
must mean every requested check ran. Unsupported configuration and processing
failure return exit 2, separately from a rejected asset (exit 1).

The engine delegates glTF parsing/validation to Khronos. Shared browser-safe
presentation lives in `packages/core/src/present.ts`. Consult
[architecture](docs/architecture.md) and [AGENTS.md](AGENTS.md) before changing
contracts or adding a layer. Discuss substantial features in an issue first.

Code identifiers, diagnostics and public documentation use English. The local
interface also supports pt-BR. Changes to translations must preserve the
canonical report, diagnostic codes and language preference behavior.

## AI-assisted contributions

AI-assisted patches are welcome when the contributor reviews the whole diff,
understands the change, verifies provenance and runs the relevant checks.
Mention substantive tool assistance when it helps review. Generated output
is not evidence that a test passed; include actual results. A human maintainer
reviews merges and releases.

## License and conduct

Submit only material you may contribute under the [MIT license](LICENSE).
Third-party assets keep their own licenses. Follow the
[code of conduct](CODE_OF_CONDUCT.md). See [security policy](SECURITY.md) for
vulnerabilities and [support](SUPPORT.md) for usage questions.
