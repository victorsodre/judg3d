import { parentPort, workerData } from "node:worker_threads";
import { loadProfile } from "@judg3d/core";
import { judge } from "@judg3d/judge";
import type { JudgeJobInput } from "./judge-job.js";

const input = workerData as JudgeJobInput;
try {
  const profile = await loadProfile(input.profilePath);
  const { report } = await judge({ bytes: input.bytes, uri: input.uri }, profile, { judg3dVersion: input.version });
  parentPort?.postMessage({ ok: true, report });
} catch {
  parentPort?.postMessage({ ok: false });
}
