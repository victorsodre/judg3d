import {
  compareExitCode,
  compareReports,
  EXIT_INFRA,
  loadProfile,
  serializeCompare,
  type ExitCode,
} from "@judg3d/core";
import { judgeIsolated, readAsset } from "@judg3d/judge";

import { reportInfraFailure } from "../infra.js";
import { renderCompare } from "../render.js";
import { assertReportDestination, writeReport } from "../report-file.js";

export type CompareCommandOptions = {
  profile: string;
  out: string;
  json: boolean;
  timestamp: boolean;
};

export type CompareCommandContext = {
  judg3dVersion: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

/**
 * Judge two assets with the same loaded profile, then write a compare document.
 * Exit 0 requires both PASS; either FAIL is 1; infrastructure is 2 without a new file.
 */
export async function runCompareCommand(
  beforePath: string,
  afterPath: string,
  options: CompareCommandOptions,
  context: CompareCommandContext,
): Promise<ExitCode> {
  try {
    const loaded = await loadProfile(options.profile);
    const beforeAsset = await readAsset(beforePath);
    const afterAsset = await readAsset(afterPath);

    await assertReportDestination(options.out, [
      beforePath,
      afterPath,
      options.profile,
    ]);

    const judgeOptions = {
      judg3dVersion: context.judg3dVersion,
      ...(options.timestamp ? { timestamp: true } : {}),
    };
    const before = await judgeIsolated({
      asset: beforeAsset,
      profile: loaded,
      options: judgeOptions,
    });
    const after = await judgeIsolated({
      asset: afterAsset,
      profile: loaded,
      options: judgeOptions,
    });

    const document = compareReports(before, after, {
      judg3dVersion: context.judg3dVersion,
    });
    const serialized = serializeCompare(document);
    await writeReport(options.out, serialized, [
      beforePath,
      afterPath,
      options.profile,
    ]);

    if (options.json || options.out === "-") {
      context.stdout(serialized.trimEnd());
    } else {
      context.stdout(renderCompare(document, options.out));
    }

    return compareExitCode(document);
  } catch (error) {
    reportInfraFailure(error, context);
    return EXIT_INFRA;
  }
}
