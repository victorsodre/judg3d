const messages = {
  ORIGIN_REJECTED: "Request origin is not allowed.",
  BUSY: "Files are already being processed. Try again shortly.",
  UPLOAD_TOO_LARGE: "The upload exceeds the size limit.",
  ROUTE_NOT_FOUND: "Route not found.",
  INVALID_MULTIPART: "Invalid multipart form.",
  ASSET_REQUIRED: 'Send a GLB or glTF file in the multipart "asset" field.',
  INVALID_PROFILE: "Invalid profile name.",
  PROFILE_NOT_FOUND: "Profile not found or invalid.",
  ANALYSIS_FAILED:
    "Could not complete analysis with this profile. Check its rules or try a smaller file.",
  INTERNAL_ERROR: "Unexpected failure while judging the asset.",
  PROFILES_UNAVAILABLE: "Could not list profiles.",
} as const;

export type ApiErrorCode = keyof typeof messages;
export type JudgeErrorBody = {
  ok: false;
  exitHint: 2;
  error: "infra" | "bad_request";
  code: ApiErrorCode;
  message: string;
  detail?: string;
};

export function apiError(
  code: ApiErrorCode,
  error: JudgeErrorBody["error"] = "bad_request",
): JudgeErrorBody {
  return { ok: false, exitHint: 2, error, code, message: messages[code] };
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && Object.hasOwn(messages, value);
}
