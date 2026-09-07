# Security policy

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/victorsodre/judg3d/security/advisories/new).
The channel is enabled for this repository. Keep exploit details, assets,
credentials and personal information out of public issues. For release controls,
see the [release checklist](docs/maintainers/release.md).

Include the affected version, runtime, minimal reproduction, expected boundary
and impact. Use a synthetic or redistributable asset. Do not test other users'
files or services. Reports are handled by the maintainer on a best-effort basis;
there is no guaranteed response time or paid bounty.

## Supported versions

The current 0.1.0 candidate is the maintained implementation. The historical
0.0.1 npm placeholder is not a usable validator. Security fixes target the latest
maintained version; this early project has no long-term support branches.

## Boundaries

- The app listens on loopback only. It is not a hosted, multi-user service.
- Uploaded files stay in memory during local analysis. No telemetry or remote
  resource fetch is required. The UI does not persist preferences or assets.
- CLI, HTTP and MCP analysis use a worker with a 30-second deadline and a
  256 MiB V8 old-generation limit. This is not an OS sandbox or total RSS cap.
- Assets are limited to 64 MiB; profiles to 1 MiB. HTTP and MCP allow two
  simultaneous analyses. Operational limits return infrastructure failure.
- MCP paths and symlink targets must stay in the chosen workspace. Use a narrow
  root. Workspace contents and its ancestor directories must be controlled by
  the operator; concurrent local filesystem mutation is outside this boundary.
- Direct library `judge()` runs in-process; use `judgeIsolated()` for untrusted
  assets. Stronger isolation for hostile inputs requires a separate OS user or
  sandbox at the embedding application's boundary.
- Reports may include filenames, profile identifiers and asset-originated
  diagnostics. Review reports before sharing them publicly.

PASS certifies only the layers in `coverage.ran`. It is not a malware scan,
visual-quality rating or proof that every possible flaw has been found.

For trust boundaries and risk-driven tests, see [architecture](docs/architecture.md).
