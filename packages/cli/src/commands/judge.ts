import { assertReportDestination, writeReport } from "../report-file.js";

import {
  EXIT_FAIL,
  EXIT_INFRA,
  EXIT_PASS,
  InfraError,
  loadProfile,
  serializeReport,
  type ExitCode,
} from "@judg3d/core";
import { judgeIsolated, readAsset } from "@judg3d/judge";

import { terminalText } from "../format.js";
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

/** Exit 0 requires a computed PASS; asset rejection is 1 and infrastructure failure is 2 without a new report. */
export async function runJudgeCommand(
  assetPath: string,
  options: JudgeCommandOptions,
  context: JudgeCommandContext,
): Promise<ExitCode> {
  try {
    const loaded = await loadProfile(options.profile);
    const asset = await readAsset(assetPath);

    await assertReportDestination(options.out, [assetPath, options.profile]);
    const report = await judgeIsolated({
      asset,
      profile: loaded,
      options: {
        judg3dVersion: context.judg3dVersion,
        ...(options.timestamp ? { timestamp: true } : {}),
      },
    });

    const serialized = serializeReport(report);
    await writeReport(options.out, serialized, [assetPath, options.profile]);

    if (options.json || options.out === "-") {
      context.stdout(serialized.trimEnd());
    } else {
      context.stdout(renderReport(report, options.out));
    }

    return report.verdict.pass ? EXIT_PASS : EXIT_FAIL;
  } catch (error) {
    reportInfraFailure(error, context);
    return EXIT_INFRA;
  }
}

function reportInfraFailure(
  error: unknown,
  context: JudgeCommandContext,
): void {
  if (error instanceof InfraError) {
    context.stderr(`judg3d: ${terminalText(error.message)}`);
    if (error.detail !== undefined) {
      context.stderr(terminalText(error.detail));
    }
  } else {
    context.stderr(
      `judg3d: unexpected failure — ${terminalText(error instanceof Error ? error.message : String(error))}`,
    );
  }
  context.stderr(
    "This is an infrastructure failure (exit 2), not an asset rejection.",
  );
}
