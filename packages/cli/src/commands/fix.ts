import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  compareReports,
  EXIT_INFRA,
  InfraError,
  buildRepairPlan,
  isJudgeReport,
  isSafeRepairStep,
  loadProfile,
  repairExitCode,
  serializeRepair,
  sha256Hex,
  STRIP_UNUSED_EXTRAS_STEP_ID,
  suggestedFixedName,
  type ExitCode,
  type JudgeReport,
  type RepairApplication,
  type RepairDocument,
  type RepairFinding,
} from "@judg3d/core";
import {
  inspectExtras,
  judgeIsolated,
  readAsset,
  stripUnusedExtras,
} from "@judg3d/judge";
import { reportInfraFailure } from "../infra.js";
import { renderRepair } from "../render.js";
import {
  assertReportDestination,
  writeBinary,
  writeReport,
} from "../report-file.js";

export type FixCommandOptions = {
  profile: string;
  out: string;
  json: boolean;
  apply: boolean;
  maxSteps: number;
  outAsset?: string;
  fromReport?: string;
};

export type FixCommandContext = {
  judg3dVersion: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

/**
 * Judge (or accept a matching report), emit a repair plan, and optionally apply
 * safe extras stripping before compare. Plan-only exits 0; apply uses the
 * after-asset verdict.
 */
export async function runFixCommand(
  assetPath: string,
  options: FixCommandOptions,
  context: FixCommandContext,
): Promise<ExitCode> {
  try {
    const loaded = await loadProfile(options.profile);
    const asset = await readAsset(assetPath);
    const protectedPaths = [assetPath, options.profile];
    await assertReportDestination(options.out, protectedPaths);

    const judgeOptions = { judg3dVersion: context.judg3dVersion };
    const before = await loadOrJudge(
      asset,
      loaded,
      options.fromReport,
      judgeOptions,
    );

    const extras = inspectExtras(asset.bytes);
    const findings: RepairFinding[] =
      extras.pointers.length === 0
        ? []
        : [{ kind: "extras", pointers: extras.pointers }];
    const outAsset = resolveOutAsset(assetPath, options.outAsset);
    const plan = buildRepairPlan(before, findings, {
      commandAsset: assetPath,
      commandOutput: outAsset,
    });

    const applied: RepairApplication[] = [];
    let after: JudgeReport | undefined;
    let compare: RepairDocument["compare"];
    let afterBytes: Uint8Array | undefined;

    if (options.apply) {
      const safe = plan.steps
        .filter(isSafeRepairStep)
        .slice(0, options.maxSteps);
      afterBytes = asset.bytes;
      for (const step of plan.steps.filter(isSafeRepairStep)) {
        if (!safe.some((item) => item.id === step.id)) {
          applied.push({
            id: step.id,
            status: "skipped",
            detail: `Beyond --max-steps ${options.maxSteps}.`,
          });
          continue;
        }
        if (step.id === STRIP_UNUSED_EXTRAS_STEP_ID) {
          const result = stripUnusedExtras(afterBytes);
          if (!result.changed) {
            applied.push({
              id: step.id,
              status: "skipped",
              detail: "No extras remained to strip.",
            });
            continue;
          }
          afterBytes = result.bytes;
          applied.push({
            id: step.id,
            status: "applied",
            detail: `Removed extras at ${result.removed.join(", ")}.`,
          });
          continue;
        }
        applied.push({
          id: step.id,
          status: "skipped",
          detail: "No verified automatic transform is registered for this step.",
        });
      }

      const mutated = applied.some((item) => item.status === "applied");
      if (mutated) {
        await writeBinary(outAsset, afterBytes, [
          ...protectedPaths,
          ...(options.out === "-" ? [] : [options.out]),
        ]);
        const repaired = await readAsset(outAsset);
        after = await judgeIsolated({
          asset: repaired,
          profile: loaded,
          options: judgeOptions,
        });
        compare = compareReports(before, after, {
          judg3dVersion: context.judg3dVersion,
        });
      } else {
        after = before;
      }
    }

    const document: RepairDocument = {
      judg3dVersion: context.judg3dVersion,
      mode: options.apply ? "apply" : "plan",
      asset: before.asset,
      profile: before.profile,
      before,
      plan,
      applied,
      ...(after === undefined ? {} : { after }),
      ...(compare === undefined ? {} : { compare }),
    };

    const serialized = serializeRepair(document);
    await writeReport(options.out, serialized, [
      ...protectedPaths,
      ...(options.apply && afterBytes !== undefined && after !== before
        ? [outAsset]
        : []),
    ]);

    if (options.json || options.out === "-") {
      context.stdout(serialized.trimEnd());
    } else {
      context.stdout(
        renderRepair(document, options.out, options.apply ? outAsset : undefined),
      );
    }

    return repairExitCode(document);
  } catch (error) {
    reportInfraFailure(error, context);
    return EXIT_INFRA;
  }
}

export function parseMaxSteps(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new InfraError("--max-steps must be an integer from 0 to 100.");
  }
  return parsed;
}

async function loadOrJudge(
  asset: { bytes: Uint8Array; uri: string },
  loaded: Awaited<ReturnType<typeof loadProfile>>,
  fromReport: string | undefined,
  judgeOptions: { judg3dVersion: string },
): Promise<JudgeReport> {
  if (fromReport !== undefined) {
    let raw: string;
    try {
      raw = await readFile(fromReport, "utf8");
    } catch (cause) {
      throw new InfraError(
        `Could not read report: ${fromReport}`,
        cause instanceof Error ? cause.message : String(cause),
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new InfraError(
        `Invalid report: ${fromReport} is not valid JSON.`,
        cause instanceof Error ? cause.message : String(cause),
      );
    }
    if (!isJudgeReport(parsed)) {
      throw new InfraError(`Invalid report: ${fromReport} is not a judge report.`);
    }
    const assetHash = sha256Hex(asset.bytes);
    if (
      parsed.asset.sha256 === assetHash &&
      parsed.profile.sha256 === loaded.sha256
    ) {
      return parsed;
    }
  }

  return judgeIsolated({
    asset,
    profile: loaded,
    options: judgeOptions,
  });
}

function resolveOutAsset(assetPath: string, requested?: string): string {
  if (requested !== undefined) {
    return resolve(requested);
  }
  const absolute = resolve(assetPath);
  return join(dirname(absolute), suggestedFixedName(basename(absolute)));
}
