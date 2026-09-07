import { parentPort, workerData } from "node:worker_threads";
import { InfraError } from "@judg3d/core";
import { judge } from "./judge.js";
import type { IsolatedInput, WorkerResult } from "./isolated.js";

const input = workerData as IsolatedInput;
let result: WorkerResult;
try {
  const { report } = await judge(input.asset, input.profile, input.options);
  result = { ok: true, report };
} catch (error) {
  result =
    error instanceof InfraError
      ? {
          ok: false,
          message: error.message,
          ...(error.detail === undefined ? {} : { detail: error.detail }),
        }
      : { ok: false, message: "Unexpected failure while judging the asset." };
}
parentPort?.postMessage(result);
