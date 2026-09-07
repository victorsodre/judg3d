import { Worker } from "node:worker_threads";
import type { JudgeReport } from "@judg3d/core";

export type JudgeJobInput = { bytes: Uint8Array; uri: string; profilePath: string; version: string };
type WorkerResult = { ok: true; report: JudgeReport } | { ok: false };

export class JudgeJobError extends Error {}

export async function runJudgeJob(input: JudgeJobInput, timeoutMs: number): Promise<JudgeReport> {
  const worker = new Worker(new URL("../dist/judge-worker.js", import.meta.url), {
    workerData: input,
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
  try {
    return await new Promise<JudgeReport>((resolve, reject) => {
      const timer = setTimeout(() => { reject(new JudgeJobError("O processamento excedeu o limite de tempo.")); }, timeoutMs);
      const finish = (result?: JudgeReport, error?: Error): void => {
        clearTimeout(timer);
        if (error !== undefined) reject(error);
        else if (result !== undefined) resolve(result);
      };
      worker.once("message", (message: WorkerResult) => {
        if (message.ok) finish(message.report);
        else finish(undefined, new JudgeJobError("Não foi possível processar o arquivo com este profile."));
      });
      worker.once("error", () => { finish(undefined, new JudgeJobError("Falha no processo de análise do arquivo.")); });
      worker.once("exit", () => { finish(undefined, new JudgeJobError("O processo de análise foi encerrado.")); });
    });
  } finally {
    await worker.terminate();
  }
}
