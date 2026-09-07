export const messages = {
  en: {
    tagline: "Local asset validation. Same profile rules, same verdict.",
    asset: "Asset",
    profile: "Profile",
    dropTitle: "Drop your GLB here",
    dropHint: "or click to choose · .glb / .gltf · up to 64 MB",
    changeFile: "click to change",
    fileTooLarge: "Choose a file no larger than 64 MB.",
    noProfiles: "No profiles available. Configure a profile to get started.",
    judge: "Judge asset",
    judging: "Judging…",
    cancel: "Cancel analysis",
    cancelled: "Analysis cancelled. No verdict was produced.",
    reconnect: "Reconnect",
    loading: "loading…",
    checks: "Checks",
    scope: "Appearance, geometry and semantics are not evaluated yet.",
    infra: "Analysis could not be completed",
    infraNote: "No verdict was produced (exit code 2).",
    network: "Could not reach the local API. Try reconnecting.",
    invalidJson: "The local API did not return valid JSON. Try reconnecting.",
    invalidProfiles: "The API returned an invalid profile list.",
    invalidReport:
      "The API returned an invalid result. No verdict was accepted.",
    reportMismatch: "The downloadable report differs from the received result.",
    local: "Local processing · SCHEMA and PROFILE",
    privacy: "your file stays on this computer",
    pass: "Passed",
    fail: "Failed",
    error: "error",
    errors: "errors",
    warning: "warning",
    warnings: "warnings",
    verified: "Checked",
    skipped: "Not evaluated",
    none: "none",
    triangles: "triangles",
    vertices: "vertices",
    materials: "materials",
    drawCalls: "draw calls",
    textures: "textures",
    dimensions: "dimensions",
    upTo: "up to",
    download: "Download judge-report.json",
    noViolations: "No violations in the checks performed.",
    filter: "Filter by code, location or message",
    of: "of",
    occurrences: "occurrences",
    page: "page",
    pages: "Violation pages",
    previous: "Previous",
    next: "Next",
    document: "Entire document",
    ORIGIN_REJECTED: "This request origin is not allowed.",
    BUSY: "Files are already being processed. Try again shortly.",
    UPLOAD_TOO_LARGE: "The upload exceeds the size limit.",
    ROUTE_NOT_FOUND: "The requested route was not found.",
    INVALID_MULTIPART: "The upload form is invalid. Please try again.",
    ASSET_REQUIRED: "Choose a GLB or glTF file to analyze.",
    INVALID_PROFILE: "The profile name is invalid.",
    PROFILE_NOT_FOUND: "The profile was not found or is invalid.",
    ANALYSIS_FAILED:
      "Could not complete analysis with this profile. Check its rules or try a smaller file.",
    INTERNAL_ERROR: "An unexpected error prevented analysis. Please try again.",
    PROFILES_UNAVAILABLE: "Could not load profiles. Try reconnecting.",
  },
} as const;

export type MessageKey = keyof typeof messages.en;
export class UiError extends Error {
  constructor(readonly key: MessageKey) {
    super(messages.en[key]);
  }
}

export function errorKey(error: unknown): MessageKey {
  return error instanceof UiError ? error.key : "network";
}
