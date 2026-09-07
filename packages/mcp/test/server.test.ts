import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { createJudgeServer } from "../src/server.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));

describe("MCP real", () => {
  it.each(["legacy", "auto"] as const)(
    "negocia %s e preserva PASS, FAIL e infra",
    async (mode) => {
      const server = await createJudgeServer({ root, version: "test" });
      const client = new Client(
        { name: "test", version: "1" },
        { versionNegotiation: { mode } },
      );
      const [a, b] = InMemoryTransport.createLinkedPair();
      try {
        await server.connect(a);
        await client.connect(b);
        const listing = await client.listTools();
        expect(listing.tools.map((tool) => tool.name)).toEqual(["judge_asset"]);
        expect(listing.tools[0]?.annotations?.readOnlyHint).toBe(true);
        for (const [asset, exitHint] of [
          ["valido.glb", 0],
          ["quebrado.glb", 1],
        ] as const) {
          const result = await client.callTool({
            name: "judge_asset",
            arguments: {
              asset: `fixtures/${asset}`,
              profile: "profiles/web-commerce.json",
            },
          });
          expect(result.isError).not.toBe(true);
          expect(result.structuredContent).toMatchObject({
            ok: true,
            exitHint,
            report: { verdict: { pass: exitHint === 0 } },
          });
          expect(JSON.stringify(result)).not.toContain(root);
        }
        const missing = await client.callTool({
          name: "judge_asset",
          arguments: {
            asset: "missing.glb",
            profile: "profiles/web-commerce.json",
          },
        });
        expect(missing.isError).toBe(true);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  it("recusa traversal e links que escapam do workspace", async () => {
    const parent = await mkdtemp(join(tmpdir(), "judg3d-mcp-"));
    const workspace = await mkdtemp(join(parent, "workspace-"));
    await writeFile(join(parent, "outside.glb"), "private content");
    await symlink(join(parent, "outside.glb"), join(workspace, "alias.glb"));
    const server = await createJudgeServer({
      root: workspace,
      version: "test",
    });
    const client = new Client({ name: "test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(a);
      await client.connect(b);
      for (const asset of ["../outside.glb", "alias.glb"]) {
        const result = await client.callTool({
          name: "judge_asset",
          arguments: { asset, profile: "profile.json" },
        });
        expect(result.isError).toBe(true);
        expect(JSON.stringify(result)).toContain("authorized workspace");
        expect(JSON.stringify(result)).not.toContain("private content");
      }
    } finally {
      await client.close();
      await server.close();
      await rm(parent, { recursive: true, force: true });
    }
  });
});
