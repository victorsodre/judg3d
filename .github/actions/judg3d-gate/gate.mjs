#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { accessSync, constants as fsConstants } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** CLI exit codes. Do not invent a fourth meaning. */
export const EXIT_PASS = 0;
export const EXIT_FAIL = 1;
export const EXIT_INFRA = 2;

const MAX_VISIBLE_VIOLATIONS = 200;

export function parseAssetList(input) {
  return String(input ?? "")
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function isGlob(token) {
  return /[*?[]/.test(token);
}

export function parseFailOn(value) {
  const failOn = String(value ?? "rejected").trim() || "rejected";
  if (failOn === "rejected" || failOn === "never") return failOn;
  return null;
}

export function cliPrefix(cli, version) {
  const trimmed = String(cli ?? "").trim();
  if (trimmed) return trimmed.split(/\s+/);
  const pin = String(version ?? "").trim() || "0.1.0";
  return ["npx", "--yes", `judg3d@${pin}`];
}

export function reportFileName(assetPath, index) {
  const safe = assetPath
    .replace(/^[./\\]+/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefix = String(index + 1).padStart(2, "0");
  return `${prefix}-${safe || "asset"}.json`;
}

export function combineJudgeExits(exits) {
  if (exits.includes(EXIT_INFRA)) return EXIT_INFRA;
  if (exits.includes(EXIT_FAIL)) return EXIT_FAIL;
  return EXIT_PASS;
}

export function stepExitCode(judgeExit, failOn) {
  if (judgeExit === EXIT_INFRA) return EXIT_INFRA;
  if (judgeExit === EXIT_FAIL && failOn === "rejected") return EXIT_FAIL;
  return EXIT_PASS;
}

export function profileFileName(profile) {
  const name = basename(String(profile).trim());
  return name.endsWith(".json") ? name : `${name}.json`;
}

export function globToRegExp(pattern) {
  const source = pattern
    .replace(/\\/g, "/")
    .replace(/[.+^${}()|\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${source}$`);
}

export function globPrefix(pattern) {
  const normalized = pattern.replace(/\\/g, "/");
  const wildcard = normalized.search(/[*?[]/);
  if (wildcard === -1) return "";
  const cut = normalized.lastIndexOf("/", wildcard);
  return cut === -1 ? "" : normalized.slice(0, cut);
}

export async function matchGlob(pattern, cwd) {
  const regex = globToRegExp(pattern);
  const prefix = globPrefix(pattern);
  const start = prefix ? join(cwd, prefix) : cwd;
  const files = [];
  await walkFiles(start, prefix, (relativePath) => {
    if (regex.test(relativePath)) files.push(relativePath);
  });
  return files.sort();
}

async function walkFiles(dir, rel, visit) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
    const nextAbs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".")) {
        continue;
      }
      await walkFiles(nextAbs, nextRel, visit);
    } else if (entry.isFile()) visit(nextRel);
  }
}

export async function expandAssets(tokens, cwd, globFn = matchGlob) {
  const assets = [];
  for (const token of tokens) {
    if (isGlob(token)) {
      const matches = (await globFn(token, cwd)).sort();
      if (matches.length === 0) {
        throw infraError(`No files matched ${token}.`);
      }
      assets.push(...matches);
      continue;
    }
    const absolute = resolve(cwd, token);
    try {
      accessSync(absolute, fsConstants.R_OK);
    } catch {
      throw infraError(`Asset not found: ${token}`);
    }
    assets.push(token);
  }
  return unique(assets);
}

export async function resolveProfile(profile, cwd, bundledDir) {
  const trimmed = String(profile ?? "").trim();
  if (!trimmed) {
    throw infraError("Profile is required (JSON path or bundled name).");
  }
  const asPath = resolve(cwd, trimmed);
  if (isReadableFile(asPath)) return asPath;
  if (!bundledDir) {
    throw infraError(
      `Profile file not found: ${trimmed}. Pass a JSON path or a bundled name such as web-commerce.`,
    );
  }
  const candidate = join(bundledDir, profileFileName(trimmed));
  if (isReadableFile(candidate)) return candidate;
  const available = (await readdir(bundledDir))
    .filter((name) => name.endsWith(".json"))
    .sort();
  throw infraError(
    `Unknown profile ${trimmed}. Bundled profiles: ${available.join(", ") || "(none)"}.`,
  );
}

export function markdownSummary(results) {
  const lines = ["# judg3d gate", ""];
  for (const result of results) {
    lines.push(...renderResult(result), "");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function renderResult(result) {
  if (result.kind === "infra") {
    return [
      `## Infrastructure failure — \`${escapeInline(result.asset ?? "gate")}\``,
      "",
      result.message,
      "",
      "Exit 2 means configuration, I/O or processing failed. This is not an asset rejection and no new verdict was produced.",
      ...(result.stderr
        ? ["", "<details><summary>CLI stderr</summary>", "", "```", result.stderr, "```", "", "</details>"]
        : []),
    ];
  }
  const report = result.report;
  const passed = report.verdict.pass;
  const title = passed
    ? `## PASSED — \`${escapeInline(result.asset)}\``
    : `## FAILED — \`${escapeInline(result.asset)}\``;
  const lines = [
    title,
    "",
    `- Exit: \`${result.exit}\` (${passed ? "accepted" : "rejected"})`,
    `- Profile: \`${escapeInline(report.profile.id)}@${escapeInline(report.profile.version)}\``,
    `- Asset: \`${escapeInline(report.asset.uri)}\` (${report.asset.bytes} bytes, sha256 \`${report.asset.sha256.slice(0, 12)}\`)`,
    `- Coverage ran: ${report.coverage.ran.join(", ") || "—"}`,
    `- Coverage skipped: ${report.coverage.skipped.join(", ") || "—"}`,
    `- Report: \`${escapeInline(result.reportPath)}\``,
  ];
  const violations = report.verdict.violations;
  if (violations.length > 0) {
    const visible = violations.slice(0, MAX_VISIBLE_VIOLATIONS);
    lines.push("", "| Severity | Code | Location | Detail |", "| --- | --- | --- | --- |");
    for (const violation of visible) {
      lines.push(
        `| ${violation.severity} | \`${escapeCell(violation.code)}\` | ${escapeCell(violation.nodePath || "Entire document")} | ${escapeCell(detailOf(violation))} |`,
      );
    }
    if (visible.length < violations.length) {
      lines.push(
        "",
        `${violations.length - visible.length} additional occurrences are in the JSON report.`,
      );
    }
  }
  lines.push(
    "",
    "<details><summary>JSON report</summary>",
    "",
    "```json",
    result.serialized.trimEnd(),
    "```",
    "",
    "</details>",
  );
  return lines;
}

export function detailOf(violation) {
  const message = messageOf(violation.got);
  if (message) return message;
  const got = compact(violation.got);
  const want = compact(violation.want);
  if (got && want) return `${got} → expected ${want}`;
  return got ?? want ?? "";
}

function messageOf(got) {
  if (got && typeof got === "object" && typeof got.message === "string") {
    return got.message;
  }
  return undefined;
}

function compact(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const text = JSON.stringify(value);
    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
  } catch {
    return undefined;
  }
}

export async function runCommand(command, args, cwd, timeoutMs) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolvePromise({
        exit: EXIT_INFRA,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: `${error.message}\n${Buffer.concat(stderr).toString("utf8")}`,
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const exit =
        signal === "SIGKILL"
          ? EXIT_INFRA
          : typeof code === "number"
            ? code
            : EXIT_INFRA;
      resolvePromise({
        exit,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

export async function bundledProfilesDir(prefix, cwd, timeoutMs) {
  const [command, ...args] = prefix;
  const result = await runCommand(command, [...args, "profiles"], cwd, timeoutMs);
  if (result.exit !== EXIT_PASS) {
    throw infraError(
      `Could not resolve bundled profiles via \`${prefix.join(" ")} profiles\`.`,
      result.stderr || result.stdout,
    );
  }
  const dir = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!dir) {
    throw infraError("The profiles command printed no directory.");
  }
  return dir;
}

export async function runGate(options) {
  const cwd = resolve(options.cwd);
  const failOn = parseFailOn(options.failOn);
  const results = [];
  if (failOn === null) {
    results.push({
      kind: "infra",
      asset: "gate",
      message: `Unknown fail-on value ${options.failOn}. Use rejected (default) or never. The profile still owns failOn for the verdict.`,
    });
    return finish(results, EXIT_INFRA, options);
  }

  let tokens;
  let assets;
  let profilePath;
  try {
    tokens = parseAssetList(options.assets);
    if (tokens.length === 0) {
      throw infraError("At least one .glb/.gltf path is required.");
    }
    assets = await expandAssets(tokens, cwd, options.glob);
    const prefix = cliPrefix(options.cli, options.version);
    const needsBundled = !isReadableFile(resolve(cwd, String(options.profile ?? "").trim()));
    const bundledDir = needsBundled
      ? await bundledProfilesDir(prefix, cwd, options.timeoutMs)
      : undefined;
    profilePath = await resolveProfile(options.profile, cwd, bundledDir);
    await mkdir(resolve(options.reportDir), { recursive: true });

    for (const [index, asset] of assets.entries()) {
      const reportPath = join(options.reportDir, reportFileName(asset, index));
      const judged = await runCommand(
        prefix[0],
        [...prefix.slice(1), "judge", asset, "--profile", profilePath, "--out", reportPath],
        cwd,
        options.timeoutMs,
      );
      if (judged.stdout) process.stdout.write(judged.stdout.endsWith("\n") ? judged.stdout : `${judged.stdout}\n`);
      if (judged.stderr) process.stderr.write(judged.stderr.endsWith("\n") ? judged.stderr : `${judged.stderr}\n`);
      if (judged.exit === EXIT_INFRA || !isReadableFile(reportPath)) {
        results.push({
          kind: "infra",
          asset,
          message:
            judged.exit === EXIT_INFRA
              ? "judg3d returned exit 2. This is an infrastructure failure, not an asset rejection."
              : `judg3d exited ${judged.exit} without writing ${relative(cwd, reportPath)}.`,
          stderr: judged.stderr.trim() || undefined,
          exit: EXIT_INFRA,
        });
        continue;
      }
      const serialized = await readFile(reportPath, "utf8");
      let report;
      try {
        report = JSON.parse(serialized);
      } catch {
        results.push({
          kind: "infra",
          asset,
          message: `Report at ${relative(cwd, reportPath)} is not valid JSON.`,
          exit: EXIT_INFRA,
        });
        continue;
      }
      const expected = report.verdict?.pass ? EXIT_PASS : EXIT_FAIL;
      if (judged.exit !== expected) {
        results.push({
          kind: "infra",
          asset,
          message: `judg3d exited ${judged.exit} but the report verdict.pass is ${String(report.verdict?.pass)}. Expected exit 0 for PASS and 1 for rejection.`,
          stderr: judged.stderr.trim() || undefined,
          exit: EXIT_INFRA,
        });
        continue;
      }
      results.push({
        kind: "judge",
        asset,
        exit: judged.exit,
        report,
        serialized,
        reportPath: relative(cwd, reportPath) || reportPath,
      });
    }
  } catch (error) {
    results.push({
      kind: "infra",
      asset: "gate",
      message: error instanceof Error ? error.message : String(error),
      stderr: error instanceof InfraError ? error.detail : undefined,
    });
  }

  const judgeExit = combineJudgeExits(
    results.map((result) => (result.kind === "infra" ? EXIT_INFRA : result.exit)),
  );
  return finish(results, judgeExit, options);
}

async function finish(results, judgeExit, options) {
  const failOn = parseFailOn(options.failOn) ?? "rejected";
  const stepExit = stepExitCode(judgeExit, failOn);
  const summary = markdownSummary(results);
  const reportDir = relative(options.cwd, options.reportDir) || options.reportDir;
  await mkdir(resolve(options.reportDir), { recursive: true });
  if (options.summaryPath) {
    await mkdir(dirname(resolve(options.summaryPath)), { recursive: true });
    await writeFile(options.summaryPath, summary, { flag: "a" });
  } else if (stepExit !== EXIT_PASS) {
    process.stdout.write(summary);
  }
  if (options.outputPath) {
    await appendOutput(options.outputPath, {
      passed: judgeExit === EXIT_PASS ? "true" : "false",
      "exit-code": String(judgeExit),
      "report-dir": reportDir,
    });
  }
  return { results, judgeExit, stepExit, summary, reportDir };
}

async function appendOutput(outputPath, values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}\n`);
  await writeFile(outputPath, lines.join(""), { flag: "a" });
}

function unique(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.split(sep).join("/");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function isReadableFile(path) {
  try {
    accessSync(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function escapeInline(text) {
  return String(text).replace(/`/g, "'");
}

function escapeCell(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

class InfraError extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
  }
}

function infraError(message, detail) {
  return new InfraError(message, detail);
}

function invokedDirectly() {
  const argv1 = process.argv[1];
  return argv1 !== undefined && resolve(argv1) === fileURLToPath(import.meta.url);
}

export async function main(env = process.env) {
  const cwd = resolve(env.JUDG3D_WORKING_DIRECTORY || env.GITHUB_WORKSPACE || process.cwd());
  const reportDir = resolve(cwd, env.JUDG3D_REPORT_DIR || "judg3d-reports");
  const timeoutMs = Number(env.JUDG3D_TIMEOUT_MS || 40_000);
  const result = await runGate({
    cwd,
    assets: env.JUDG3D_ASSETS || "",
    profile: env.JUDG3D_PROFILE || "",
    version: env.JUDG3D_VERSION || "0.1.0",
    failOn: env.JUDG3D_FAIL_ON || "rejected",
    cli: env.JUDG3D_CLI || "",
    reportDir,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 40_000,
    summaryPath: env.GITHUB_STEP_SUMMARY,
    outputPath: env.GITHUB_OUTPUT,
  });
  process.exitCode = result.stepExit;
  return result;
}

if (invokedDirectly()) {
  await main().catch((error) => {
    process.stderr.write(
      `judg3d-gate: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.stderr.write(
      "This is an infrastructure failure (exit 2), not an asset rejection.\n",
    );
    process.exitCode = EXIT_INFRA;
  });
}
