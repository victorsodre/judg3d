import { apiError } from "../api-errors.js";
import { resolveProfileFile } from "./profiles.js";

import {
  serializeReport,
  MAX_ASSET_BYTES,
  type JudgeReport,
} from "@judg3d/core";
import type { Context } from "hono";

import { APP_VERSION } from "../version.js";
import { JudgeJobError, runJudgeJob } from "../judge-job.js";

export type JudgeSuccessBody = {
  ok: true;
  exitHint: 0 | 1;
  report: JudgeReport;
  serialized: string;
};

export type { JudgeErrorBody } from "../api-errors.js";

function asFile(value: unknown): File | undefined {
  if (value instanceof File) {
    return value;
  }
  return undefined;
}

export function createJudgeHandler(profilesDir: string, timeoutMs = 30_000) {
  return async function judgeHandler(c: Context): Promise<Response> {
    try {
      let body;
      try {
        body = await c.req.parseBody({ all: true });
      } catch {
        return c.json(apiError("INVALID_MULTIPART"), 400);
      }
      const asset = asFile(body["asset"]);
      if (asset === undefined) {
        return c.json(apiError("ASSET_REQUIRED"), 400);
      }

      if (asset.size > MAX_ASSET_BYTES) {
        return c.json(apiError("UPLOAD_TOO_LARGE"), 413);
      }

      const profileField = body["profile"];
      const profileName =
        typeof profileField === "string" && profileField.trim() !== ""
          ? profileField.trim()
          : "web-commerce.json";

      if (
        profileName.includes("/") ||
        profileName.includes("\\") ||
        profileName.includes("..")
      ) {
        return c.json(apiError("INVALID_PROFILE"), 400);
      }

      let profilePath: string;
      try {
        profilePath = await resolveProfileFile(profilesDir, profileName);
      } catch {
        return c.json(apiError("PROFILE_NOT_FOUND"), 400);
      }
      const bytes = new Uint8Array(await asset.arrayBuffer());
      const uri = asset.name.trim() !== "" ? asset.name : "upload.glb";

      const report = await runJudgeJob(
        { bytes, uri, profilePath, version: APP_VERSION },
        timeoutMs,
        c.req.raw.signal,
      );

      const payload: JudgeSuccessBody = {
        ok: true,
        exitHint: report.verdict.pass ? 0 : 1,
        report,
        serialized: serializeReport(report),
      };
      return c.json(payload);
    } catch (error) {
      if (error instanceof JudgeJobError) {
        return c.json(apiError("ANALYSIS_FAILED", "infra"), 500);
      }
      return c.json(apiError("INTERNAL_ERROR", "infra"), 500);
    }
  };
}
