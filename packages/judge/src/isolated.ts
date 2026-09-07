import { Worker } from "node:worker_threads";
import { InfraError, type JudgeReport, type LoadedProfile } from "@judg3d/core";
import type { JudgeInput, JudgeOptions } from "./judge.js";

export type IsolatedInput = {
  asset: JudgeInput;
  profile: LoadedProfile;
  options: JudgeOptions;
};
export type WorkerResult =
  | { ok: true; report: JudgeReport }
  | { ok: false; message: string; detail?: string };

export async function judgeIsolated(
  input: IsolatedInput,
  {
    timeoutMs = 30_000,
    signal,
  }: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<JudgeReport> {
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 300_000
  ) {
    throw new InfraError("Timeout must be between 1 and 300000 ms.");
  }
  if (signal?.aborted === true) throw new InfraError("Analysis cancelled.");
  const worker = new Worker(new URL("./worker.js", import.meta.url), {
    workerData: input,
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await new Promise<JudgeReport>((resolve, reject) => {
      onAbort = () => {
        reject(new InfraError("Analysis cancelled."));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => {
        reject(new InfraError("Analysis exceeded the time limit."));
      }, timeoutMs);
      worker.once("message", (result: WorkerResult) => {
        if (result.ok) resolve(result.report);
        else reject(new InfraError(result.message, result.detail));
      });
      worker.once("error", () => {
        reject(new InfraError("The asset analysis process failed."));
      });
      worker.once("exit", () => {
        reject(new InfraError("The analysis process exited without a result."));
      });
    });
  } finally {
    clearTimeout(timer);
    if (onAbort !== undefined) signal?.removeEventListener("abort", onAbort);
    await worker.terminate();
  }
}
