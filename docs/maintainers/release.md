# Release checklist

A release is a reviewed source revision and verified package set, not just a
successful local build. Preparation scripts never publish or change GitHub.

## Prepare locally

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test
pnpm docs:check
pnpm demo
pnpm release:pack
pnpm release:check
pnpm audit --audit-level=high
```

Check the changelog, package versions, MIT license and third-party notices.
Inspect `artifacts/release/manifest.json` and `verification.json`: package hashes
must match the artifacts actually tested. Run the clean-install check on the
minimum Node version as well as a current supported runtime. Preserve fixture
hashes. Review new dependencies and platform-specific behavior.

Run a redacted secret scan of the working tree and full Git history. A clean
secret scan does not establish that all old business notes, author identities
or personal paths are suitable for publication. Review deleted files and commit
metadata as well as the current tree. Keep a private backup before any explicitly
authorized history cleanup. Old pull-request references can retain removed
commits; do not assume a force-push removes their contents from the hosting service.

## Publish source only after owner approval

- Review the exact diff, intended MIT scope and historical exposure.
- Commit and push the approved source; verify remote CI and secret-scan results.
- Make the repository public only after that review. Verify anonymous access to
  the README, license, demo and maintainer profile.
- Enable GitHub private vulnerability reporting and test that the reporting link
  works. Keep ownership and merge permissions narrow; require passing CI and
  review for merges. Update the repository description and topics to match the
  current implementation.

Repository settings changes, pushes and publication are external actions and
require explicit authorization. A local passing check is not a remote CI result.

## Publish packages only after owner approval

Confirm access to the `@judg3d/*` names and that version 0.1.0 is available.
Publish only the tarballs in the reviewed manifest, in dependency order:
core → judge → app and mcp → cli. Scoped packages require public access.
Use the owner's authorized npm authentication and publishing controls; do not
paste tokens or recovery codes into the repository or review discussion.

After publication, test a clean installation from the registry, inspect package
metadata/licenses and confirm CLI/MCP/UI behavior. Only then change the README
from source-install instructions to a verified registry quickstart. Create the
release notes and tag against the tested source revision. Do not publish from
`tools/npm-placeholder/`.

## Rollback

Before publication, remove only generated artifacts or restore reviewed files
from a task-specific backup. Preserve other work. After a reviewed commit, use
a revert commit for source corrections. Fix a published package through an
appropriate follow-up release or dist-tag change; do not assume deleting a
version retracts copies already distributed. Reverify the actual rollback target.
