import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import {
  compareExitCode,
  compareReports,
  InfraError,
  loadProfile,
  serializeCompare,
  serializeReport,
  type JudgeReport,
  type LoadedProfile,
} from "@judg3d/core";
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

const PATH_FIELD = z
  .string()
  .min(1)
  .max(4096);

const TOOL_HINTS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

async function judgeWorkspaceAsset(
  root: string,
  asset: string,
  loaded: LoadedProfile,
  version: string,
  extra: { timeoutMs?: number; signal?: AbortSignal },
): Promise<JudgeReport> {
  const assetPath = await workspaceFile(root, asset);
  const input = await readAsset(assetPath);
  input.uri = relative(root, assetPath).split(sep).join("/");
  return judgeIsolated(
    {
      asset: input,
      profile: loaded,
      options: { judg3dVersion: version },
    },
    extra,
  );
}

export async function createJudgeServer(
  options: ServerOptions,
): Promise<McpServer> {
  const root = await realpath(options.root);
  if (!(await stat(root)).isDirectory())
    throw new InfraError("The workspace must be a directory.");
  const server = new McpServer({ name: "judg3d", version: options.version });
  let active = 0;
  const isolation = (
    signal: AbortSignal | undefined,
  ): { timeoutMs?: number; signal?: AbortSignal } => ({
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(signal === undefined ? {} : { signal }),
  });
  const busy = (): CallToolResult | undefined =>
    active >= 2
      ? failure("Two analyses are already running. Try again when they finish.")
      : undefined;
  const asInfra = (error: unknown): CallToolResult =>
    failure(
      error instanceof InfraError
        ? error.message.replaceAll(root, "[workspace]")
        : "Could not analyze the local asset.",
    );

  server.registerTool(
    "judge_asset",
    {
      title: "Judge a local 3D asset",
      description:
        "Validate glTF/GLB with SCHEMA and PROFILE. Paths are relative to the authorized workspace. Does not assess appearance, geometry or semantics. FAIL is a valid result; infrastructure failures return isError and exitHint 2. Does not read external resources or write files.",
      inputSchema: z.strictObject({
        asset: PATH_FIELD.describe("Asset path inside the workspace."),
        profile: PATH_FIELD.describe("JSON profile path inside the workspace."),
      }),
      annotations: TOOL_HINTS,
    },
    async ({ asset, profile }, ctx) => {
      const blocked = busy();
      if (blocked !== undefined) return blocked;
      active += 1;
      try {
        const loaded = await loadProfile(await workspaceFile(root, profile));
        const report = await judgeWorkspaceAsset(
          root,
          asset,
          loaded,
          options.version,
          isolation(ctx.mcpReq.signal),
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
        return asInfra(error);
      } finally {
        active -= 1;
      }
    },
  );
  server.registerTool(
    "compare_assets",
    {
      title: "Compare two local 3D assets",
      description:
        "Judge two glTF/GLB files against the same profile and return a metric/verdict diff. Paths stay inside the authorized workspace. Both sides use one profile; differing profile bytes are an infrastructure failure. Unperformed layers are not PASS. Either asset FAIL is a valid result (exitHint 1). Does not write files or fetch URLs.",
      inputSchema: z.strictObject({
        before: PATH_FIELD.describe(
          "Earlier asset path inside the workspace.",
        ),
        after: PATH_FIELD.describe("Later asset path inside the workspace."),
        profile: PATH_FIELD.describe("JSON profile path inside the workspace."),
      }),
      annotations: TOOL_HINTS,
    },
    async ({ before, after, profile }, ctx) => {
      const blocked = busy();
      if (blocked !== undefined) return blocked;
      active += 1;
      try {
        const loaded = await loadProfile(await workspaceFile(root, profile));
        const extra = isolation(ctx.mcpReq.signal);
        const beforeReport = await judgeWorkspaceAsset(
          root,
          before,
          loaded,
          options.version,
          extra,
        );
        const afterReport = await judgeWorkspaceAsset(
          root,
          after,
          loaded,
          options.version,
          extra,
        );
        const compare = compareReports(beforeReport, afterReport, {
          judg3dVersion: options.version,
        });
        return {
          content: [{ type: "text", text: serializeCompare(compare) }],
          structuredContent: {
            ok: true,
            exitHint: compareExitCode(compare),
            compare,
          },
        };
      } catch (error) {
        return asInfra(error);
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
