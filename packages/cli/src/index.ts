#!/usr/bin/env node
import { Command } from "commander";

import { EXIT_INFRA } from "@judg3d/core";
import { engineVersions } from "@judg3d/judge";

import { runJudgeCommand } from "./commands/judge.js";
import { CLI_VERSION } from "./version.js";

const program = new Command();

program
  .name("judg3d")
  .description("Juiz de aceitacao para assets 3D. Pre-alpha: so a camada L1 SCHEMA.")
  .version(CLI_VERSION, "-v, --version");

program
  .command("judge")
  .description("Julga um arquivo glTF/GLB contra um profile e grava o relatorio.")
  .argument("<asset>", "caminho do .glb ou .gltf")
  .requiredOption("-p, --profile <arquivo>", "profile JSON com as regras")
  .option("-o, --out <arquivo>", "onde gravar o relatorio", "judge-report.json")
  .option("--json", "imprime o relatorio JSON em vez do resumo humano", false)
  .option("--timestamp", "inclui generatedAt (quebra o determinismo do arquivo)", false)
  .addHelpText(
    "after",
    [
      "",
      "Exit codes:",
      "  0  asset aprovado",
      "  1  asset reprovado",
      "  2  falha de infraestrutura — nenhum veredito foi produzido",
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
  .description("Mostra as versoes do runtime que assinam o veredito.")
  .action(() => {
    const engine = engineVersions();
    process.stdout.write(`judg3d           ${CLI_VERSION}\n`);
    process.stdout.write(`gltf-validator   ${engine.gltfValidator}\n`);
    process.stdout.write(`node             ${engine.node}\n`);
    process.stdout.write(
      `extensoes glTF   ${engine.gltfExtensions.length} suportadas\n`,
    );
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  process.stderr.write(
    `judg3d: falha inesperada — ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = EXIT_INFRA;
}
