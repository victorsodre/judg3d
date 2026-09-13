#!/usr/bin/env node
import { Command, CommanderError } from "commander";

import { EXIT_INFRA } from "@judg3d/core";
import { engineVersions } from "@judg3d/judge";

import { runCompareCommand } from "./commands/compare.js";
import { parseMaxSteps, runFixCommand } from "./commands/fix.js";
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
  .command("compare")
  .description(
    "Judge two glTF/GLB files against the same profile and write a metric/verdict diff.",
  )
  .argument("<before>", "path to the earlier .glb or .gltf file")
  .argument("<after>", "path to the later .glb or .gltf file")
  .requiredOption("-p, --profile <file>", "JSON profile containing the rules")
  .option(
    "-o, --out <file>",
    "compare document destination (- for stdout only)",
    "compare-report.json",
  )
  .option(
    "--json",
    "print the JSON compare document instead of the human summary",
    false,
  )
  .option(
    "--timestamp",
    "include generatedAt on both judge reports (makes the document non-deterministic)",
    false,
  )
  .addHelpText(
    "after",
    [
      "",
      "Both assets are judged independently with the same profile bytes.",
      "Unperformed layers are never treated as PASS.",
      "",
      "Exit codes:",
      "  0  both assets passed the checks that ran",
      "  1  at least one asset failed; the compare document was still written",
      "  2  infrastructure failure — no compare document was produced",
    ].join("\n"),
  )
  .action(
    async (
      before: string,
      after: string,
      options: {
        profile: string;
        out: string;
        json: boolean;
        timestamp: boolean;
      },
    ) => {
      const code = await runCompareCommand(before, after, options, {
        judg3dVersion: CLI_VERSION,
        stdout: (line) => process.stdout.write(`${line}\n`),
        stderr: (line) => process.stderr.write(`${line}\n`),
      });
      process.exitCode = code;
    },
  );

program
  .command("fix")
  .description(
    "Build an ordered repair plan from a judge report. Optionally apply safe extras stripping and compare.",
  )
  .argument("<asset>", "path to the .glb or .gltf file")
  .requiredOption("-p, --profile <file>", "JSON profile containing the rules")
  .option(
    "-o, --report <file>",
    "repair document destination (- for stdout only)",
    "repair-report.json",
  )
  .option("--json", "print the JSON document instead of the human summary", false)
  .option("--apply", "apply up to --max-steps safe transforms, then re-judge and compare", false)
  .option("--max-steps <n>", "maximum safe automatic steps to apply", "2")
  .option("--out-asset <file>", "destination for a repaired copy when --apply writes bytes")
  .option("--from-report <file>", "reuse a judge report when asset and profile hashes match")
  .addHelpText(
    "after",
    [
      "",
      "Without --apply the command only prints the plan and exits 0.",
      "With --apply, safe extras stripping may write --out-asset (default <name>.fixed.glb).",
      "Budget and schema repairs stay as commands; they are not remeshed automatically.",
      "After a mutation, the existing compare path diffs before and after.",
      "",
      "Exit codes:",
      "  0  plan-only succeeded, or --apply left a passing asset",
      "  1  --apply ran and the asset still fails the profile",
      "  2  infrastructure failure — no new document was produced",
    ].join("\n"),
  )
  .action(
    async (
      asset: string,
      options: {
        profile: string;
        report: string;
        json: boolean;
        apply: boolean;
        maxSteps: string;
        outAsset?: string;
        fromReport?: string;
      },
    ) => {
      try {
        const code = await runFixCommand(
          asset,
          {
            profile: options.profile,
            out: options.report,
            json: options.json,
            apply: options.apply,
            maxSteps: parseMaxSteps(options.maxSteps),
            ...(options.outAsset === undefined
              ? {}
              : { outAsset: options.outAsset }),
            ...(options.fromReport === undefined
              ? {}
              : { fromReport: options.fromReport }),
          },
          {
            judg3dVersion: CLI_VERSION,
            stdout: (line) => process.stdout.write(`${line}\n`),
            stderr: (line) => process.stderr.write(`${line}\n`),
          },
        );
        process.exitCode = code;
      } catch (error) {
        process.stderr.write(
          `judg3d: ${error instanceof Error ? error.message : "unexpected failure"}\n`,
        );
        process.stderr.write(
          "This is an infrastructure failure (exit 2), not an asset rejection.\n",
        );
        process.exitCode = EXIT_INFRA;
      }
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
