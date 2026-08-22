import { join } from "node:path";

import {
  isInfraError,
  loadProfile,
  serializeReport,
  type JudgeReport,
} from "@judg3d/core";
import { judge } from "@judg3d/judge";
import type { Context } from "hono";

import { APP_VERSION } from "../version.js";

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

export function createJudgeHandler(profilesDir: string) {
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
      const loaded = await loadProfile(profilePath);
      const bytes = new Uint8Array(await asset.arrayBuffer());
      const uri = asset.name.trim() !== "" ? asset.name : "upload.glb";

      const { report } = await judge(
        { bytes, uri },
        loaded,
        { judg3dVersion: APP_VERSION },
      );

      const payload: JudgeSuccessBody = {
        ok: true,
        exitHint: report.verdict.pass ? 0 : 1,
        report,
        serialized: serializeReport(report),
      };
      return c.json(payload);
    } catch (error) {
      if (isInfraError(error)) {
        return c.json(
          {
            ok: false,
            exitHint: 2,
            error: "infra",
            message: error.message,
            ...(error.detail !== undefined ? { detail: error.detail } : {}),
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
          detail: error instanceof Error ? error.message : String(error),
        } satisfies JudgeErrorBody,
        500,
      );
    }
  };
}
