import { join } from "node:path";

import {
  serializeReport,
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

export type JudgeErrorBody = {
  ok: false;
  exitHint: 2;
  error: "infra" | "bad_request";
  message: string;
  detail?: string;
};

function asFile(value: unknown): File | undefined {
  if (value instanceof File) {
    return value;
  }
  return undefined;
}

export function createJudgeHandler(profilesDir: string, timeoutMs = 30_000) {
  return async function judgeHandler(c: Context): Promise<Response> {
    try {
      const body = await c.req.parseBody({ all: true });
      const asset = asFile(body["asset"]);
      if (asset === undefined) {
        return c.json(
          {
            ok: false,
            exitHint: 2,
            error: "bad_request",
            message: "Envie o arquivo GLB no campo multipart \"asset\".",
          } satisfies JudgeErrorBody,
          400,
        );
      }

      const profileField = body["profile"];
      const profileName =
        typeof profileField === "string" && profileField.trim() !== ""
          ? profileField.trim()
          : "web-commerce.json";

      if (profileName.includes("/") || profileName.includes("\\") || profileName.includes("..")) {
        return c.json(
          {
            ok: false,
            exitHint: 2,
            error: "bad_request",
            message: "Nome de profile invalido.",
          } satisfies JudgeErrorBody,
          400,
        );
      }

      const profilePath = join(profilesDir, profileName);
      const bytes = new Uint8Array(await asset.arrayBuffer());
      const uri = asset.name.trim() !== "" ? asset.name : "upload.glb";

      const report = await runJudgeJob({ bytes, uri, profilePath, version: APP_VERSION }, timeoutMs);

      const payload: JudgeSuccessBody = {
        ok: true,
        exitHint: report.verdict.pass ? 0 : 1,
        report,
        serialized: serializeReport(report),
      };
      return c.json(payload);
    } catch (error) {
      if (error instanceof JudgeJobError) {
        return c.json(
          {
            ok: false,
            exitHint: 2,
            error: "infra",
            message: error.message,
          } satisfies JudgeErrorBody,
          500,
        );
      }
      return c.json(
        {
          ok: false,
          exitHint: 2,
          error: "infra",
          message: "Falha inesperada ao julgar o asset.",
        } satisfies JudgeErrorBody,
        500,
      );
    }
  };
}
