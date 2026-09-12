# Try judg3d with one of your own assets

Allow 15–20 minutes. You need Node 22.13 or later and a GLB or self-contained
glTF file you are allowed to process. A small nonconfidential asset is ideal.
You do not need an OpenAI account or API key.

## Start locally

Start the published app:

```sh
npx --yes judg3d@0.1.0 app
```

Open the address printed by the app. Your asset is processed locally; it is not
uploaded to a hosted service. Stop the server with `Ctrl+C`.

To run the reproducible examples or work on the source, use pnpm 11.22.0:

```sh
git clone https://github.com/victorsodre/judg3d.git
cd judg3d
pnpm install --frozen-lockfile
pnpm build
pnpm judg3d app
```

## Try one real task

1. Select an asset and inspect the selected profile. `web-commerce` currently
   performs SCHEMA checks only; its name does not imply commerce suitability.
2. Choose **Judge asset**. Explain the result in your own words before looking
   at the documentation: what passed, what failed and what was not checked?
3. If relevant, copy a profile and set budgets for your actual pipeline. The
   `agent-loop` limits are examples. Start with `--profiles ./your-profiles`
   to load your own directory.
4. If a real problem appears, correct the export in your authoring tool and
   judge it again with the same profile. judg3d does not repair the asset.
5. Download the report and decide whether it gives enough information to act.

For a known before/after pair, use the [repair-loop example](../../examples/repair-loop/README.md)
and `judg3d compare` on the two exports. A processing/configuration error is
not an asset rejection. PASS applies only to the layers listed in the report
and does not certify visual quality.

## Send useful feedback

Use the [feedback template](feedback-template.md). Report installation problems,
confusing messages and results that disagree with independently established
facts. “This did not help my workflow” is useful feedback too.

For a public bug report, include OS, Node version, exact command or UI steps and
a minimal redistributable reproduction. Remove private paths, client identifiers
and personal information. Do not attach confidential assets. Security issues
belong in [private vulnerability reporting](https://github.com/victorsodre/judg3d/security/advisories/new).
