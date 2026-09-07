# Use judg3d with an agent

judg3d gives an agent an external, repeatable acceptance check for a local
asset. The verdict comes from Khronos validation and profile rules, not from
an LLM judging its own output. It works with any client that can call the CLI
or an MCP tool; no OpenAI API dependency is required by judg3d itself.

## Codex MCP setup

Build the repository, then configure the locally installed Codex CLI:

```sh
codex mcp add judg3d -- node /absolute/path/to/judg3d/packages/cli/dist/index.js \
  mcp --root /absolute/path/to/your-project
```

This command changes your Codex configuration; run it only for the workspace you
intend to expose. Put both the asset and profile inside that root. The `codex
mcp add` command shape was checked against the local CLI on 2026-09-07. The
[official MCP documentation](https://developers.openai.com/codex/mcp) describes
client setup and configuration options.

The tool is `judge_asset`:

```json
{ "asset": "assets/product.glb", "profile": "profiles/product.json" }
```

The response includes `structuredContent.ok`, `exitHint` and `report`.
Asset rejection is a successful tool execution with `exitHint: 1`.
Infrastructure failures set `isError: true` and return `exitHint: 2` in the
error text. No result should be interpreted as a visual-quality score.

## A bounded authoring loop

1. Select the acceptance profile before changing the asset; record its hash.
2. Call `judge_asset` after exporting the asset.
3. If exitHint is 2, resolve the infrastructure/configuration problem. There is
   no asset verdict to accept or reject.
4. If exitHint is 1, inspect diagnostic codes, locations and got/want values.
   Make a targeted correction using the authoring tool, then judge again.
5. Stop after a fixed attempt/time budget, or when the asset and diagnostics stop
   changing. Escalate unresolved issues to a human; do not loosen profile limits
   merely to obtain PASS.
6. Accept PASS only for `coverage.ran`, and retain the final asset/profile/report
   hashes. Run any required visual review separately.

For example, a project can allow at most three correction attempts before human
review. This is a workflow limit, not a judg3d acceptance threshold.

## Maintainer use of Codex

Codex can assist with minimal reproductions, regression tests, issue triage and
release-note drafts. Keep human review before merges or publication. Never send
private reports or proprietary assets to a model without authorization.

The current repository has deterministic CI checks, not an autonomous AI
review bot. Any future paid automation should be opt-in, budgeted, scoped to
approved inputs and evaluated against actual maintainer outcomes. An OpenAI
program application does not establish an affiliation or endorsement.
