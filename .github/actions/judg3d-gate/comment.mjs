/** PR comment body and GitHub issue-comment upsert for judg3d-gate. */

import { readFileSync } from "node:fs";

export const COMMENT_MARKER = "<!-- judg3d-gate -->";

export function parseCommentMode(value) {
  const mode = String(value ?? "auto").trim() || "auto";
  if (mode === "auto" || mode === "true" || mode === "false") return mode;
  return null;
}

export function shouldPostComment(commentInput, eventName) {
  const mode = parseCommentMode(commentInput);
  if (mode === null || mode === "false") return false;
  if (mode === "true") return true;
  return eventName === "pull_request";
}

export function jobLogUrl(env) {
  const server = env.GITHUB_SERVER_URL || "https://github.com";
  const repo = env.GITHUB_REPOSITORY;
  const runId = env.GITHUB_RUN_ID;
  if (!repo || !runId) return undefined;
  return `${server}/${repo}/actions/runs/${runId}`;
}

export function pullRequestNumber(env, event = undefined) {
  const payload = event ?? readEvent(env);
  const fromEvent = payload?.pull_request?.number ?? payload?.issue?.number;
  if (typeof fromEvent === "number" && fromEvent > 0) return fromEvent;
  const ref = String(env.GITHUB_REF || "");
  const match = /^refs\/pull\/(\d+)\//.exec(ref);
  return match ? Number(match[1]) : undefined;
}

export function prCommentBody({ results, compare, jobUrl }) {
  const judged = results.filter((result) => result.kind === "judge");
  const infra = results.filter((result) => result.kind === "infra");
  const allPassed =
    judged.length > 0 &&
    judged.every((result) => result.report.verdict.pass) &&
    infra.length === 0;
  const emoji = infra.length > 0 && judged.length === 0 ? "⚠️" : allPassed ? "✅" : "❌";
  const title = allPassed
    ? "judg3d passed"
    : infra.length > 0 && judged.length === 0
      ? "judg3d infrastructure failure"
      : "judg3d failed";

  const files = judged.map((result) => `\`${escapeInline(result.asset)}\``);
  const lines = [
    COMMENT_MARKER,
    "",
    `# ${emoji} ${title}`,
    "",
    judged.length === 0
      ? "No asset verdict was produced."
      : `Judged ${judged.length} file(s): ${files.join(", ")}.`,
    "",
  ];

  if (judged.length > 0) {
    lines.push(
      "| File | Result | Size | Metrics vs budget |",
      "| --- | --- | --- | --- |",
    );
    for (const result of judged) {
      const report = result.report;
      const passed = report.verdict.pass;
      lines.push(
        `| \`${escapeCell(result.asset)}\` | ${passed ? "✅ pass" : "❌ fail"} | ${report.asset.bytes} bytes | ${escapeCell(metricsVsBudget(report))} |`,
      );
    }
    lines.push("");
  }

  if (compare !== undefined) {
    lines.push(...renderCompareSummary(compare), "");
  }

  for (const result of infra) {
    lines.push(
      `Infrastructure: ${result.message}`,
      "",
      "Exit 2 is not an asset rejection; no new verdict was produced.",
      "",
    );
  }

  if (jobUrl) {
    lines.push(`[Job log](${jobUrl})`, "");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function metricsVsBudget(report) {
  const metrics = report.verdict?.metrics ?? {};
  const parts = [];
  if (typeof metrics.triangles === "number") {
    parts.push(`${metrics.triangles} triangles`);
  }
  if (typeof report.asset?.bytes === "number") {
    parts.push(`${report.asset.bytes} bytes`);
  }
  for (const violation of report.verdict?.violations ?? []) {
    const want = asRecord(violation.want);
    const got = asRecord(violation.got);
    if (typeof want.max === "number") {
      const metric = typeof want.metric === "string" ? want.metric : violation.code;
      const value = typeof got.value === "number" ? got.value : "?";
      parts.push(`${metric} ${value}/${want.max} (${violation.code})`);
    }
  }
  return parts.join("; ") || "—";
}

export function renderCompareSummary(compare) {
  const from = compare.verdicts?.before ? "PASSED" : "FAILED";
  const to = compare.verdicts?.after ? "PASSED" : "FAILED";
  const triangles = compare.metrics?.triangles;
  const bytes = compare.metrics?.assetBytes;
  const lines = [`**Before/after:** ${from} → ${to}`];
  if (triangles) {
    lines.push(
      `- triangles: ${triangles.before} → ${triangles.after} (${signed(triangles.delta)})`,
    );
  }
  if (bytes) {
    lines.push(`- size: ${bytes.before} → ${bytes.after} bytes (${signed(bytes.delta)})`);
  }
  const removed = (compare.violations?.removed ?? []).map((row) => row.code);
  if (removed.length > 0) {
    lines.push(`- removed: ${removed.join(", ")}`);
  }
  return lines;
}

export async function loadCompareArtifact(reportDir, readFileFn) {
  if (!reportDir || !readFileFn) return undefined;
  const candidates = ["compare-report.json", "compare.json"];
  for (const name of candidates) {
    try {
      const raw = await readFileFn(`${reportDir.replace(/\/$/, "")}/${name}`, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.verdicts && parsed.metrics) return parsed;
    } catch {
      // Optional artifact; absence is not a gate failure.
    }
  }
  return undefined;
}

export async function upsertPrComment({
  token,
  apiUrl = "https://api.github.com",
  owner,
  repo,
  issueNumber,
  body,
  marker = COMMENT_MARKER,
  fetchFn = fetch,
}) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "judg3d-gate",
  };
  const listUrl = `${apiUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`;
  const listed = await fetchFn(listUrl, { headers });
  if (!listed.ok) {
    throw new Error(`GitHub comments list failed: ${listed.status}`);
  }
  const comments = await listed.json();
  const existing = Array.isArray(comments)
    ? comments.find((comment) => typeof comment.body === "string" && comment.body.includes(marker))
    : undefined;
  if (existing) {
    const updated = await fetchFn(
      `${apiUrl}/repos/${owner}/${repo}/issues/comments/${existing.id}`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    if (!updated.ok) {
      throw new Error(`GitHub comment update failed: ${updated.status}`);
    }
    return { action: "updated", id: existing.id };
  }
  const created = await fetchFn(
    `${apiUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!created.ok) {
    throw new Error(`GitHub comment create failed: ${created.status}`);
  }
  const payload = await created.json();
  return { action: "created", id: payload.id };
}

function readEvent(env) {
  const path = env.GITHUB_EVENT_PATH;
  if (!path) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function signed(delta) {
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function escapeInline(text) {
  return String(text).replace(/`/g, "'");
}

function escapeCell(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
