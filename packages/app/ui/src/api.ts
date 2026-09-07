import { isApiErrorCode } from "../../src/api-errors.js";
import { UiError } from "./messages.js";
import { isJudgeReport } from "@judg3d/core/present";
import type { JudgeResponse, ProfileSummary } from "./types.js";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function json(response: Response): Promise<unknown> {
  if (!response.headers.get("Content-Type")?.includes("application/json")) {
    throw new UiError("invalidJson");
  }
  try {
    return await response.json();
  } catch {
    throw new UiError("invalidJson");
  }
}

export async function fetchProfiles(
  signal?: AbortSignal,
): Promise<ProfileSummary[]> {
  const res = await fetch("/api/profiles", {
    ...(signal === undefined ? {} : { signal }),
  });
  if (!res.ok) throw new UiError("PROFILES_UNAVAILABLE");
  const body = record(await json(res));
  const profiles = body["profiles"];
  if (
    !Array.isArray(profiles) ||
    !profiles.every((item: unknown) => {
      const profile = record(item);
      return (
        ["id", "version", "filename", "path"].every(
          (key) => typeof profile[key] === "string",
        ) &&
        Array.isArray(profile["layers"]) &&
        profile["layers"].every(
          (layer: unknown) =>
            typeof layer === "string" &&
            ["SCHEMA", "PROFILE", "GEOMETRY", "VISUAL", "SEMANTIC"].includes(
              layer,
            ),
        )
      );
    })
  )
    throw new UiError("invalidProfiles");
  return profiles as ProfileSummary[];
}

export async function judgeAsset(
  file: File,
  profileFilename: string,
  signal?: AbortSignal,
): Promise<JudgeResponse> {
  const form = new FormData();
  form.set("asset", file, file.name);
  form.set("profile", profileFilename);
  const res = await fetch("/api/judge", {
    method: "POST",
    body: form,
    ...(signal === undefined ? {} : { signal }),
  });
  const body = record(await json(res));
  if (
    body["ok"] === true &&
    res.ok &&
    isJudgeReport(body["report"]) &&
    body["exitHint"] === (body["report"].verdict.pass ? 0 : 1) &&
    typeof body["serialized"] === "string"
  ) {
    let serializedReport: unknown;
    try {
      serializedReport = JSON.parse(body["serialized"]);
    } catch {
      throw new UiError("invalidReport");
    }
    if (JSON.stringify(serializedReport) !== JSON.stringify(body["report"])) {
      throw new UiError("reportMismatch");
    }
    return {
      ok: true,
      exitHint: body["report"].verdict.pass ? 0 : 1,
      report: body["report"],
      serialized: body["serialized"],
    };
  }
  if (
    body["ok"] === false &&
    body["exitHint"] === 2 &&
    isApiErrorCode(body["code"]) &&
    typeof body["message"] === "string" &&
    (body["error"] === "infra" || body["error"] === "bad_request")
  ) {
    return {
      ok: false,
      exitHint: 2,
      message: body["message"],
      code: body["code"],
      error: body["error"],
    };
  }
  throw new UiError("invalidReport");
}

export { formatBytes, shortHash, violationDetail } from "@judg3d/core/present";
