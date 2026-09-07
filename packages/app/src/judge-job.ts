import { InfraError, loadProfile, type JudgeReport } from "@judg3d/core";
import { judgeIsolated } from "@judg3d/judge";

export type JudgeJobInput = {
  bytes: Uint8Array;
  uri: string;
  profilePath: string;
  version: string;
};
export { InfraError as JudgeJobError };

export async function runJudgeJob(
  input: JudgeJobInput,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<JudgeReport> {
  return judgeIsolated(
    {
      asset: { bytes: input.bytes, uri: input.uri },
      profile: await loadProfile(input.profilePath),
      options: { judg3dVersion: input.version },
    },
    { timeoutMs, ...(signal === undefined ? {} : { signal }) },
  );
}
