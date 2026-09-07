# @judg3d/mcp

Local MCP server exposing `judge_asset`. Run `judg3d mcp --root /path/to/project`.
Uses the official v2 SDK over stdio. Descriptions and outputs are in English.

Arguments: `{ "asset": "model.glb", "profile": "profile.json" }`.
Paths and symlink targets must remain inside the authorized workspace.
The tool does not fetch URLs or write files. Reports are returned as text and
structuredContent. FAIL is a normal result (exitHint 1); infrastructure failures
use isError and exitHint 2. At most two concurrent analyses, 30 seconds per
analysis, and 64 MiB per asset.

`createJudgeServer({ root, version })` supports embedding the server.
`startMcp({ root, version })` connects the stdio transport.
