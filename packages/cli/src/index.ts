#!/usr/bin/env node
import { Command, CommanderError } from "commander";

import { EXIT_INFRA } from "@judg3d/core";
import { engineVersions } from "@judg3d/judge";

import { runJudgeCommand } from "./commands/judge.js";
import { CLI_VERSION } from "./version.js";

const program = new Command().exitOverride();

program
  .name("judg3d")
  .description(
    "Acceptance checks for 3D assets. SCHEMA and PROFILE, with explicit coverage.",
  )
  .version(CLI_VERSION, "-v, --version");

program
  .command("judge")
  .description("Judge a glTF/GLB file against a profile and write the report.")
  .argument("<asset>", "path to the .glb or .gltf file")
  .requiredOption("-p, --profile <file>", "JSON profile containing the rules")
  .option(
    "-o, --out <file>",
    "report destination (- for stdout only)",
    "judge-report.json",
  )
  .option("--json", "print the JSON report instead of the human summary", false)
  .option(
    "--timestamp",
    "include generatedAt (makes the report non-deterministic)",
    false,
  )
  .addHelpText(
    "after",
    [
      "",
      "Exit codes:",
      "  0  asset passed",
      "  1  asset failed",
      "  2  infrastructure failure — no verdict was produced",
    ].join("\n"),
  )
  .action(
    async (
      asset: string,
      options: {
        profile: string;
        out: string;
        json: boolean;
        timestamp: boolean;
      },
    ) => {
      const code = await runJudgeCommand(asset, options, {
        judg3dVersion: CLI_VERSION,
        stdout: (line) => process.stdout.write(`${line}\n`),
        stderr: (line) => process.stderr.write(`${line}\n`),
      });
      process.exitCode = code;
    },
  );

program
  .command("engine")
  .description("Show the runtime versions used to produce the verdict.")
  .action(() => {
    const engine = engineVersions();
    process.stdout.write(`judg3d           ${CLI_VERSION}\n`);
    process.stdout.write(`gltf-validator   ${engine.gltfValidator}\n`);
    process.stdout.write(`node             ${engine.node}\n`);
    process.stdout.write(
      `glTF extensions  ${engine.gltfExtensions.length} supported\n`,
    );
  });

program
  .command("app")
  .description("Start the local app and display its browser address.")
  .option("--port <number>", "local port (0 chooses an available port)", "8787")
  .option("--profiles <directory>", "directory containing JSON profiles")
  .action(async (options: { port: string; profiles?: string }) => {
    const { startApp } = await import("@judg3d/app");
    const server = await startApp({
      port: Number(options.port),
      ...(options.profiles === undefined
        ? {}
        : { profilesDir: options.profiles }),
    });
    const shutdown = (): void => {
      server.close();
      if ("closeAllConnections" in server) server.closeAllConnections();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });

program
  .command("mcp")
  .description("Start MCP over stdio; stdout is reserved for the protocol.")
  .option(
    "--root <directory>",
    "authorized workspace for assets and profiles",
    process.cwd(),
  )
  .action(async (options: { root: string }) => {
    const { startMcp } = await import("@judg3d/mcp");
    const server = await startMcp({ root: options.root, version: CLI_VERSION });
    const shutdown = (): void => {
      void server.close();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });

program
  .command("profiles")
  .description("Show the directory containing bundled profiles.")
  .action(async () => {
    const { resolveProfilesDir } = await import("@judg3d/app");
    process.stdout.write(`${resolveProfilesDir()}\n`);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode === 0 ? 0 : EXIT_INFRA;
  } else {
    process.stderr.write(
      `judg3d: ${error instanceof Error ? error.message : "unexpected failure"}\n`,
    );
    process.exitCode = EXIT_INFRA;
  }
}
