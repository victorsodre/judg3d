import type { CompareDocument } from "./compare.js";
import type { LayerKind, Violation } from "./contract.js";
import { EXIT_FAIL, EXIT_PASS, type ExitCode } from "./exit-codes.js";
import type { JudgeReport } from "./report.js";

/** How a repair step can be carried out. Safe steps may mutate a copy of the GLB. */
export type RepairAutoApply = "safe" | "command" | "manual";

/** One ordered action derived from a report finding. Not a Verdict field. */
export type RepairStep = {
  id: string;
  code: string;
  kind: LayerKind;
  priority: number;
  title: string;
  rationale: string;
  autoApply: RepairAutoApply;
  occurrences: number;
  nodePath?: string;
  command?: string;
  got?: unknown;
  want?: unknown;
};

/** Extra findings collected outside the judge report (never invented metrics). */
export type RepairFinding = {
  kind: "extras";
  pointers: readonly string[];
};

export type RepairPlan = {
  steps: RepairStep[];
};

export type RepairApplication = {
  id: string;
  status: "applied" | "skipped" | "failed";
  detail: string;
};

/**
 * Envelope for `judg3d fix`. Plan generation is deterministic for equal
 * `(report, findings, command paths)`.
 */
export type RepairDocument = {
  judg3dVersion: string;
  mode: "plan" | "apply";
  asset: JudgeReport["asset"];
  profile: JudgeReport["profile"];
  before: JudgeReport;
  after?: JudgeReport;
  compare?: CompareDocument;
  plan: RepairPlan;
  applied: RepairApplication[];
};

export type RepairPlanOptions = {
  /** Input path shown in suggested commands. Defaults to the report URI. */
  commandAsset?: string;
  /** Suggested output path for tool commands. */
  commandOutput?: string;
};

const SCHEMA_PRIORITY = 10;
const UNAVAILABLE_PRIORITY = 20;
const EXTERNAL_PRIORITY = 30;
const EXTRAS_PRIORITY = 40;
const TEXTURE_PRIORITY = 50;
const MATERIALS_PRIORITY = 60;
const DRAW_CALLS_PRIORITY = 70;
const VERTICES_PRIORITY = 80;
const TRIANGLES_PRIORITY = 90;
const NEAR_BUDGET_PRIORITY = 100;
const OTHER_PROFILE_PRIORITY = 95;

const STRIP_EXTRAS_ID = "strip-unused-extras";

/** Build an ordered plan from a completed report plus optional extras pointers. */
export function buildRepairPlan(
  report: JudgeReport,
  findings: readonly RepairFinding[] = [],
  options: RepairPlanOptions = {},
): RepairPlan {
  const input = options.commandAsset ?? report.asset.uri;
  const output = options.commandOutput ?? suggestedFixedName(input);
  const steps: RepairStep[] = [];

  for (const group of groupViolations(report.verdict.violations)) {
    steps.push(stepFromGroup(group, input, output));
  }

  for (const finding of findings) {
    if (finding.pointers.length > 0) {
      const pointers = sortStrings(finding.pointers);
      const extrasPath = pointers[0];
      steps.push({
        id: STRIP_EXTRAS_ID,
        code: "UNUSED_EXTRAS",
        kind: "PROFILE",
        priority: EXTRAS_PRIORITY,
        title: "Strip unused extras and metadata",
        rationale:
          "glTF extras are application metadata and are not used for rendering. Removing them is a safe byte-level cleanup; it does not remesh or recompress the asset.",
        autoApply: "safe",
        occurrences: pointers.length,
        ...(extrasPath === undefined ? {} : { nodePath: extrasPath }),
        command: `judg3d fix ${shellArg(input)} --profile PROFILE --apply --out-asset ${shellArg(output)}`,
        got: { pointers },
        want: { extras: "absent" },
      });
    }
  }

  steps.sort(compareSteps);
  return { steps };
}

/** Exit 0 for plan-only. Apply exits 0 only when the after (or before) asset passed. */
export function repairExitCode(document: RepairDocument): ExitCode {
  if (document.mode === "plan") {
    return EXIT_PASS;
  }
  const report = document.after ?? document.before;
  return report.verdict.pass ? EXIT_PASS : EXIT_FAIL;
}

/** Stable JSON serialization with a trailing newline. */
export function serializeRepair(document: RepairDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function suggestedFixedName(uri: string): string {
  const name = fileName(uri);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return `${name}.fixed.glb`;
  }
  return `${name.slice(0, dot)}.fixed${name.slice(dot)}`;
}

export function isSafeRepairStep(step: RepairStep): boolean {
  return step.autoApply === "safe";
}

export const STRIP_UNUSED_EXTRAS_STEP_ID = STRIP_EXTRAS_ID;

function stepFromGroup(
  group: ViolationGroup,
  input: string,
  output: string,
): RepairStep {
  const sample = group.items[0];
  const nodePath = firstNodePath(group.items);
  const base = {
    id: `finding-${group.code}`,
    code: group.code,
    kind: group.kind,
    occurrences: group.items.length,
    ...(nodePath === undefined ? {} : { nodePath }),
    ...(sample === undefined ? {} : { got: sample.got, want: sample.want }),
  };

  if (group.kind === "SCHEMA") {
    return {
      ...base,
      priority: SCHEMA_PRIORITY,
      title: `Correct schema diagnostic ${group.code}`,
      rationale:
        "SCHEMA failures come from the Khronos glTF Validator. Re-export a valid glTF 2.0 file. judg3d does not rewrite accessors, buffers or meshes.",
      autoApply: "manual",
    };
  }

  if (
    group.code === "METRICS_UNAVAILABLE" ||
    group.code === "TEXTURE_METRICS_UNAVAILABLE"
  ) {
    return {
      ...base,
      priority: UNAVAILABLE_PRIORITY,
      title: "Restore measurable metrics",
      rationale:
        "PROFILE could not measure this asset, so budgets were not checked. Fix the unreadable image or validator info, then judge again. An unperformed check must not be treated as PASS.",
      autoApply: "manual",
    };
  }

  if (group.code === "EXTERNAL_RESOURCE") {
    return {
      ...base,
      priority: EXTERNAL_PRIORITY,
      title: "Embed external resources",
      rationale:
        "The profile requires a self-contained asset. Re-export as a GLB with buffers and images embedded. judg3d does not fetch URIs.",
      autoApply: "manual",
    };
  }

  const budget = readBudget(sample);
  if (group.code === "TEXTURE_OVER_BUDGET" && budget.max !== undefined) {
    return {
      ...base,
      priority: TEXTURE_PRIORITY,
      title: "Reduce texture resolution",
      rationale: `Largest image edge is over the profile budget (${budget.value ?? "?"} > ${budget.max} px). Resize or recompress in the authoring tool, then re-judge. Automatic resize is not applied because it changes appearance.`,
      autoApply: "command",
      command: `npx --yes @gltf-transform/cli resize ${shellArg(input)} ${shellArg(output)} --width ${budget.max} --height ${budget.max}`,
    };
  }

  if (group.code === "MATERIALS_OVER_BUDGET" && budget.max !== undefined) {
    return {
      ...base,
      priority: MATERIALS_PRIORITY,
      title: "Reduce material count",
      rationale: `Materials ${budget.value ?? "?"} exceed the profile maximum ${budget.max}. Merge materials in the DCC and re-export. judg3d does not invent a merged palette.`,
      autoApply: "manual",
    };
  }

  if (group.code === "DRAW_CALLS_OVER_BUDGET" && budget.max !== undefined) {
    return {
      ...base,
      priority: DRAW_CALLS_PRIORITY,
      title: "Reduce draw calls",
      rationale: `Draw calls ${budget.value ?? "?"} exceed the profile maximum ${budget.max}. Merge primitives that share a material, then re-export.`,
      autoApply: "manual",
    };
  }

  if (group.code === "VERTICES_OVER_BUDGET" && budget.max !== undefined) {
    return {
      ...base,
      priority: VERTICES_PRIORITY,
      title: "Reduce vertex count",
      rationale: `Vertices ${budget.value ?? "?"} exceed the profile maximum ${budget.max}. Decimate or re-export with less subdivision. Review the result visually; automatic decimation is not applied.`,
      autoApply: "command",
      command: simplifyCommand(input, output, budget.value, budget.max),
    };
  }

  if (group.code === "TRIANGLES_OVER_BUDGET" && budget.max !== undefined) {
    return {
      ...base,
      priority: TRIANGLES_PRIORITY,
      title: "Reduce triangle count",
      rationale: `Triangles ${budget.value ?? "?"} exceed the profile maximum ${budget.max}. Re-export with less subdivision, or run a reviewed simplify pass. judg3d does not remesh automatically.`,
      autoApply: "command",
      command: simplifyCommand(input, output, budget.value, budget.max),
    };
  }

  if (group.code.endsWith("_NEAR_BUDGET")) {
    return {
      ...base,
      priority: NEAR_BUDGET_PRIORITY,
      title: `Stay under ${group.code.replace("_NEAR_BUDGET", "").toLowerCase()} warning`,
      rationale:
        "Usage is at or above the profile nearLimit. This warning does not fail the asset by itself unless failOn is warn. Reduce the metric before it crosses the hard budget.",
      autoApply: "command",
      ...(budget.max !== undefined
        ? { command: simplifyCommand(input, output, budget.value, budget.max) }
        : {}),
    };
  }

  return {
    ...base,
    priority: OTHER_PROFILE_PRIORITY,
    title: `Address ${group.code}`,
    rationale:
      "This diagnostic came from an implemented judge layer. Use got/want in the report to make a targeted authoring change, then judge again.",
    autoApply: "manual",
  };
}

function simplifyCommand(
  input: string,
  output: string,
  value: number | undefined,
  max: number,
): string {
  const ratio = simplifyRatio(value, max);
  return `npx --yes @gltf-transform/cli simplify ${shellArg(input)} ${shellArg(output)} --ratio ${ratio}`;
}

function simplifyRatio(value: number | undefined, max: number): string {
  if (value === undefined || value <= 0) {
    return "0.50";
  }
  const ratio = max / value;
  const clamped = Math.min(0.95, Math.max(0.05, ratio));
  return (Math.round(clamped * 100) / 100).toFixed(2);
}

function readBudget(violation: Violation | undefined): {
  value?: number;
  max?: number;
} {
  if (violation === undefined) {
    return {};
  }
  const got = asRecord(violation.got);
  const want = asRecord(violation.want);
  const value =
    typeof got["value"] === "number" && Number.isFinite(got["value"])
      ? got["value"]
      : undefined;
  const max =
    typeof want["max"] === "number" && Number.isFinite(want["max"])
      ? want["max"]
      : undefined;
  return {
    ...(value === undefined ? {} : { value }),
    ...(max === undefined ? {} : { max }),
  };
}

type ViolationGroup = {
  code: string;
  kind: LayerKind;
  items: Violation[];
};

function groupViolations(violations: readonly Violation[]): ViolationGroup[] {
  const groups: ViolationGroup[] = [];
  const index = new Map<string, ViolationGroup>();
  for (const violation of violations) {
    const existing = index.get(violation.code);
    if (existing === undefined) {
      const group: ViolationGroup = {
        code: violation.code,
        kind: violation.kind,
        items: [violation],
      };
      index.set(violation.code, group);
      groups.push(group);
    } else {
      existing.items.push(violation);
    }
  }
  return groups;
}

function firstNodePath(items: readonly Violation[]): string | undefined {
  for (const item of items) {
    if (item.nodePath !== undefined && item.nodePath !== "") {
      return item.nodePath;
    }
  }
  return undefined;
}

function compareSteps(left: RepairStep, right: RepairStep): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  if (left.id === right.id) {
    return 0;
  }
  return left.id < right.id ? -1 : 1;
}

function fileName(uri: string): string {
  const parts = uri.replaceAll("\\", "/").split("/");
  return parts[parts.length - 1] || "asset.glb";
}

function shellArg(value: string): string {
  if (/^[A-Za-z0-9._=+:/@-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function sortStrings(values: readonly string[]): string[] {
  return [...values].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
