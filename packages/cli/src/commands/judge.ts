import { writeFile } from "node:fs/promises";

import {
  EXIT_FAIL,
  EXIT_INFRA,
  EXIT_PASS,
  InfraError,
  loadProfile,
  serializeReport,
  type ExitCode,
} from "@judg3d/core";
import { judge, readAsset } from "@judg3d/judge";

import { renderReport } from "../render.js";

export type JudgeCommandOptions = {
  profile: string;
  out: string;
  json: boolean;
  timestamp: boolean;
};

export type JudgeCommandContext = {
  judg3dVersion: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

/**
 * `judg3d judge <asset> --profile <p.json>`
 *
 * Exit codes, invariante 3 da spec:
 *   0  o asset passou
 *   1  o asset foi reprovado
 *   2  falha de infra — o juiz nao chegou a um veredito
 *
 * Nao existe caminho que devolva 0 sem um Verdict computado: qualquer excecao
 * inesperada cai no catch e vira 2.
 */
export async function runJudgeCommand(
  assetPath: string,
  options: JudgeCommandOptions,
  context: JudgeCommandContext,
): Promise<ExitCode> {
  try {
    const loaded = await loadProfile(options.profile);
    const asset = await readAsset(assetPath);

    const { verdict, report } = await judge(asset, loaded, {
      judg3dVersion: context.judg3dVersion,
      ...(options.timestamp ? { timestamp: true } : {}),
    });

    const serialized = serializeReport(report);
    await writeReport(options.out, serialized);

    if (options.json) {
      context.stdout(serialized.trimEnd());
    } else {
      context.stdout(renderReport(report, options.out));
    }

    return verdict.pass ? EXIT_PASS : EXIT_FAIL;
  } catch (error) {
    reportInfraFailure(error, context);
    return EXIT_INFRA;
  }
}

async function writeReport(path: string, contents: string): Promise<void> {
  try {
    await writeFile(path, contents, "utf8");
  } catch (cause) {
    throw new InfraError(
      `Nao consegui gravar o relatorio em ${path}`,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}

function reportInfraFailure(error: unknown, context: JudgeCommandContext): void {
  if (error instanceof InfraError) {
    context.stderr(`judg3d: ${error.message}`);
    if (error.detail !== undefined) {
      context.stderr(error.detail);
    }
  } else {
    context.stderr(
      `judg3d: falha inesperada — ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
    );
  }
  context.stderr(
    "Isto e uma falha de infraestrutura (exit 2), nao uma reprovacao do asset.",
  );
}
