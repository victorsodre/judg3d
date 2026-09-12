import {
  compareReports,
  serializeCompare,
  type CompareDocument,
} from "./compare.js";
import type { Violation } from "./contract.js";
import type { JudgeReport } from "./report.js";

/** Validate the received report before displaying a remote verdict. */
export function isJudgeReport(value: unknown): value is JudgeReport {
  const report = asRecord(value);
  const asset = asRecord(report["asset"]);
  const profile = asRecord(report["profile"]);
  const engine = asRecord(report["engine"]);
  const coverage = asRecord(report["coverage"]);
  const verdict = asRecord(report["verdict"]);
  const metrics = asRecord(verdict["metrics"]);
  const layerNames = ["SCHEMA", "PROFILE", "GEOMETRY", "VISUAL", "SEMANTIC"];
  const layers = (input: unknown): input is string[] =>
    Array.isArray(input) &&
    new Set(input).size === input.length &&
    input.every(
      (item: unknown) => typeof item === "string" && layerNames.includes(item),
    );
  const number = (input: unknown): boolean =>
    typeof input === "number" && Number.isFinite(input) && input >= 0;
  const hash = (input: unknown): boolean =>
    typeof input === "string" && /^[a-f0-9]{64}$/.test(input);
  const count = (input: unknown): boolean =>
    number(input) && Number.isSafeInteger(input);
  const ran = coverage["ran"];
  const skipped = coverage["skipped"];
  const engineLayers = engine["layers"];
  if (
    !layers(ran) ||
    !layers(skipped) ||
    !layers(engineLayers) ||
    ran.length === 0 ||
    ran.length !== engineLayers.length ||
    ran.some((layer, i) => layer !== engineLayers[i]) ||
    ran.some((layer) => skipped.includes(layer)) ||
    ran.length + skipped.length !== layerNames.length
  )
    return false;
  const violation = (input: unknown): boolean => {
    const item = asRecord(input);
    const box = asRecord(item["bbox2d"]);
    return (
      typeof item["code"] === "string" &&
      item["code"].length > 0 &&
      layers([item["kind"]]) &&
      ran.includes(String(item["kind"])) &&
      (item["severity"] === "error" || item["severity"] === "warn") &&
      (item["nodePath"] === undefined ||
        typeof item["nodePath"] === "string") &&
      (item["view"] === undefined || number(item["view"])) &&
      (item["bbox2d"] === undefined ||
        ["x", "y", "width", "height"].every((key) => number(box[key]))) &&
      "got" in item &&
      "want" in item
    );
  };
  const textures = asRecord(metrics["textures"]);
  const dimensions = asRecord(metrics["dimensions"]);
  return (
    typeof report["judg3dVersion"] === "string" &&
    typeof asset["uri"] === "string" &&
    count(asset["bytes"]) &&
    hash(asset["sha256"]) &&
    typeof profile["id"] === "string" &&
    typeof profile["version"] === "string" &&
    hash(profile["sha256"]) &&
    typeof engine["node"] === "string" &&
    typeof engine["gltfValidator"] === "string" &&
    (report["generatedAt"] === undefined ||
      typeof report["generatedAt"] === "string") &&
    typeof verdict["pass"] === "boolean" &&
    Array.isArray(verdict["violations"]) &&
    verdict["violations"].every(violation) &&
    (verdict["pass"]
      ? verdict["violations"].every(
          (item: unknown) => asRecord(item)["severity"] !== "error",
        )
      : verdict["violations"].length > 0) &&
    Array.isArray(verdict["views"]) &&
    verdict["views"].every((input: unknown) => {
      const view = asRecord(input);
      return (
        number(view["view"]) &&
        typeof view["path"] === "string" &&
        number(view["width"]) &&
        number(view["height"]) &&
        Array.isArray(view["annotations"]) &&
        view["annotations"].every(violation)
      );
    }) &&
    ["triangles", "vertices", "materials", "drawCalls"].every((key) =>
      count(metrics[key]),
    ) &&
    (metrics["textures"] === undefined ||
      (count(textures["count"]) && count(textures["maxSize"]))) &&
    (metrics["dimensions"] === undefined ||
      ["x", "y", "z"].every((key) => number(dimensions[key]))) &&
    (metrics["vramEstimateBytes"] === undefined ||
      number(metrics["vramEstimateBytes"]))
  );
}

/** Shared CLI and browser presentation. This module must not import Node APIs; browser consumers use @judg3d/core/present instead of the package root. */

/** English presentation by default, with explicit Brazilian Portuguese support. */
export type PresentationLocale = "en" | "pt-BR";

export function formatBytes(
  bytes: number,
  locale: PresentationLocale = "en",
): string {
  const decimal = (value: number): string =>
    locale === "pt-BR" ? value.toFixed(1).replace(".", ",") : value.toFixed(1);
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${decimal(kb)} KB`;
  }
  return `${decimal(kb / 1024)} MB`;
}

/** Short hash prefix for human-readable output. */
export function shortHash(hex: string): string {
  return hex.slice(0, 12);
}

/** Signed integer delta for human-readable compare output. */
export function formatSignedDelta(delta: number): string {
  if (delta === 0) {
    return "0";
  }
  return delta > 0 ? `+${delta}` : `${delta}`;
}

/** Validate a received compare document against a fresh derivation from its reports. */
export function isCompareDocument(value: unknown): value is CompareDocument {
  const document = asRecord(value);
  if (
    typeof document["judg3dVersion"] !== "string" ||
    !isJudgeReport(document["before"]) ||
    !isJudgeReport(document["after"])
  ) {
    return false;
  }
  try {
    const expected = compareReports(document["before"], document["after"], {
      judg3dVersion: document["judg3dVersion"],
    });
    return (
      serializeCompare(expected) ===
      serializeCompare(value as CompareDocument)
    );
  } catch {
    return false;
  }
}

/** Preserve layer diagnostics or show actionable got/want values when no message is supplied. */
export function violationDetail(
  violation: Violation,
  locale: PresentationLocale = "en",
): string | undefined {
  return messageOf(violation.got) ?? comparison(violation, locale);
}

/** Return the original layer message when present. */
export function messageOf(got: unknown): string | undefined {
  if (typeof got === "object" && got !== null && "message" in got) {
    const { message } = got;
    if (typeof message === "string") {
      return message;
    }
  }
  return undefined;
}

function comparison(
  violation: Violation,
  locale: PresentationLocale,
): string | undefined {
  const got = flatten(violation.got);
  if (got === undefined) {
    return undefined;
  }
  // Identical values on both sides are repeated context.
  const want = flatten(violation.want, asRecord(violation.got));
  return want === undefined
    ? got
    : `${got}  →  ${locale === "pt-BR" ? "esperado" : "expected"} ${want}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function flatten(
  value: unknown,
  omitSameAs: Record<string, unknown> = {},
  depth = 0,
  budget = { remaining: 100 },
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  // Presentation limits bound malformed or unusually nested library input.
  // The original got/want values remain intact in the downloadable report.
  if (depth >= 8 || budget.remaining-- <= 0) return "…";
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      if (budget.remaining <= 0) {
        parts.push("…");
        break;
      }
      parts.push(flatten(item, {}, depth + 1, budget) ?? "—");
    }
    return parts.join(", ");
  }
  if (typeof value === "object") {
    const parts: string[] = [];
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || omitSameAs[key] === item) continue;
      if (budget.remaining <= 0) {
        parts.push("…");
        break;
      }
      parts.push(`${key} ${flatten(item, {}, depth + 1, budget) ?? "—"}`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }
  // Only render known scalar types: got/want deliberately allow unknown values, but opaque objects must not become [object Object].

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  return undefined;
}
