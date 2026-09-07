import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { InfraError, loadProfile, serializeReport } from "@judg3d/core";
import { judgeIsolated, readAsset } from "@judg3d/judge";

type ServerOptions = { root: string; version: string; timeoutMs?: number };

async function workspaceFile(root: string, input: string): Promise<string> {
  let path: string;
  try {
    path = await realpath(resolve(root, input));
  } catch {
    throw new InfraError("File not found in the authorized workspace.");
  }
  const rel = relative(root, path);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new InfraError(
      "The file must be inside the authorized workspace, including symbolic link targets.",
    );
  }
  return path;
}

function failure(message: string): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ ok: false, exitHint: 2, message }),
      },
    ],
  };
}

export async function createJudgeServer(
  options: ServerOptions,
): Promise<McpServer> {
  const root = await realpath(options.root);
  if (!(await stat(root)).isDirectory())
    throw new InfraError("The workspace must be a directory.");
  const server = new McpServer({ name: "judg3d", version: options.version });
  let active = 0;
  server.registerTool(
    "judge_asset",
    {
      title: "Judge a local 3D asset",
      description:
        "Validate glTF/GLB with SCHEMA and PROFILE. Paths are relative to the authorized workspace. Does not assess appearance, geometry or semantics. FAIL is a valid result; infrastructure failures return isError and exitHint 2. Does not read external resources or write files.",
      inputSchema: z.strictObject({
        asset: z
          .string()
          .min(1)
          .max(4096)
          .describe("Asset path inside the workspace."),
        profile: z
          .string()
          .min(1)
          .max(4096)
          .describe("JSON profile path inside the workspace."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ asset, profile }, ctx) => {
      if (active >= 2)
        return failure(
          "Two analyses are already running. Try again when they finish.",
        );
      active += 1;
      try {
        const assetPath = await workspaceFile(root, asset);
        const profilePath = await workspaceFile(root, profile);
        const input = await readAsset(assetPath);
        input.uri = relative(root, assetPath).split(sep).join("/");
        const report = await judgeIsolated(
          {
            asset: input,
            profile: await loadProfile(profilePath),
            options: { judg3dVersion: options.version },
          },
          {
            ...(options.timeoutMs === undefined
              ? {}
              : { timeoutMs: options.timeoutMs }),
            signal: ctx.mcpReq.signal,
          },
        );
        return {
          content: [{ type: "text", text: serializeReport(report) }],
          structuredContent: {
            ok: true,
            exitHint: report.verdict.pass ? 0 : 1,
            report,
          },
        };
      } catch (error) {
        return failure(
          error instanceof InfraError
            ? error.message.replaceAll(root, "[workspace]")
            : "Could not analyze the local asset.",
        );
      } finally {
        active -= 1;
      }
    },
  );
  return server;
}

export async function startMcp(options: ServerOptions): Promise<McpServer> {
  const server = await createJudgeServer(options);
  await server.connect(new StdioServerTransport());
  return server;
}
