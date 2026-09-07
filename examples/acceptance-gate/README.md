# Reproduce an acceptance gate

Run from the repository root after installing dependencies:

```sh
pnpm demo
```

The demo builds judg3d and exercises the real CLI in bounded child processes.
No model, API key, network upload or generated verdict is involved.

| Case                   | Input and policy                                | Expected result                       |
| ---------------------- | ----------------------------------------------- | ------------------------------------- |
| schema-pass            | Khronos Box + web-commerce SCHEMA profile       | Exit 0, PASS                          |
| budget-fail            | The same Box + this example's 4-triangle budget | Exit 1, TRIANGLES_OVER_BUDGET         |
| format-fail            | Deliberately broken Box + SCHEMA                | Exit 1, actionable format diagnostics |
| infrastructure-failure | Missing profile                                 | Exit 2, no verdict                    |

The example limit of four triangles is deliberately small so the 12-triangle
Box exceeds it. It is a demonstration policy, not a suggested production budget.
The budget-fail case proves that format validity and pipeline acceptance differ;
changing the policy is not presented as repairing an asset.

Every successful analysis call is repeated with identical inputs and checked
for byte-identical JSON. The manifest records asset/profile/report hashes,
coverage and diagnostic codes. Outputs are in `artifacts/demo/` and excluded
from Git. Changing Node versions can change the report's runtime metadata.

The sample GLBs are immutable, licensed Khronos/Cesium fixtures. See
[provenance and attribution](../../fixtures/README.md). This is a reproducible
engineering demonstration, not evidence of independent users or deployment.

To reproduce just the budget failure:

```sh
pnpm judg3d judge fixtures/valido.glb \
  --profile examples/acceptance-gate/budget.json --out -
```

See [agent integration](../../docs/agent-integration.md) for using the same
reports in Codex or another MCP client.
