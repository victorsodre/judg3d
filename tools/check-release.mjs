import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "../packages/mcp/node_modules/@modelcontextprotocol/client/dist/index.mjs";
import { StdioClientTransport } from "../packages/mcp/node_modules/@modelcontextprotocol/client/dist/stdio.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = join(root, "artifacts/release");
assert(
  process.argv.slice(2).every((arg) => arg === "--registry"),
  "Usage: node tools/check-release.mjs [--registry]",
);
const registry = process.argv.includes("--registry");
const { packages } = JSON.parse(
  await readFile(join(artifacts, "manifest.json"), "utf8"),
);
const cwd = await mkdtemp(join(tmpdir(), "judg3d-release-"));
try {
  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  for (const entry of packages) {
    const path = join(artifacts, entry.filename);
    assert.equal(
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
      entry.sha256,
    );
    const { stdout } = await exec("tar", ["-tzf", path]);
    assert(
      stdout.split("\n").includes("package/LICENSE"),
      `${entry.name}: missing license`,
    );
    assert(
      stdout.split("\n").includes("package/THIRD_PARTY_NOTICES.md"),
      `${entry.name}: missing notices`,
    );
    const { stdout: metadata } = await exec("tar", [
      "-xOf",
      path,
      "package/package.json",
    ]);
    const packed = JSON.parse(metadata);
    assert.equal(packed.license, "MIT");
    assert.equal(
      packed.repository.url,
      "git+https://github.com/victorsodre/judg3d.git",
    );
    const { stdout: license } = await exec("tar", [
      "-xOf",
      path,
      "package/LICENSE",
    ]);
    assert.equal(license, await readFile(join(root, "LICENSE"), "utf8"));
    assert(
      !/(?:^|\/)(?:\.env|\.DS_Store|node_modules|fixtures)(?:\/|$)/m.test(
        stdout,
      ),
    );
  }
  const install = await exec(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--registry=https://registry.npmjs.org",
      ...(registry
        ? packages.map((p) => `${p.name}@${p.version}`)
        : packages.map((p) => join(artifacts, p.filename))),
    ],
    { cwd, timeout: 120_000 },
  );
  await writeFile(
    join(
      artifacts,
      registry ? "registry-install-check.log" : "install-check.log",
    ),
    install.stdout + install.stderr,
  );
  if (registry) {
    const lock = JSON.parse(
      await readFile(join(cwd, "package-lock.json"), "utf8"),
    );
    for (const entry of packages) {
      const installed = lock.packages[`node_modules/${entry.name}`];
      assert.equal(installed.version, entry.version);
      assert.equal(
        new URL(installed.resolved).origin,
        "https://registry.npmjs.org",
      );
      assert.equal(
        installed.integrity,
        `sha512-${createHash("sha512")
          .update(await readFile(join(artifacts, entry.filename)))
          .digest("base64")}`,
        `${entry.name}: registry bytes differ from reviewed tarball`,
      );
    }
  }
  const cli = join(cwd, "node_modules/judg3d/dist/index.js");
  const command = async (args, expected = 0) => {
    try {
      const result = await exec(process.execPath, [cli, ...args], {
        cwd,
        timeout: 35_000,
      });
      assert.equal(expected, 0);
      return result.stdout;
    } catch (error) {
      assert.equal(error.code, expected);
      return error.stdout;
    }
  };
  assert.equal(
    (await command(["--version"])).trim(),
    packages.find((p) => p.name === "judg3d").version,
  );
  const profiles = (await command(["profiles"])).trim();
  const profile = join(profiles, "web-commerce.json");
  for (const [name, code] of [
    ["valido.glb", 0],
    ["valido-textura.glb", 0],
    ["quebrado.glb", 1],
  ]) {
    await copyFile(join(root, "fixtures", name), join(cwd, name));
    const args = ["judge", name, "--profile", profile, "--out", "-"];
    const first = await command(args, code);
    assert.equal(first, await command(args, code));
    assert.equal(JSON.parse(first).verdict.pass, code === 0);
  }
  await command(
    ["judge", "missing.glb", "--profile", profile, "--out", "-"],
    2,
  );
  await command(["judge", "valido.glb"], 2);
  const comparePass = [
    "compare",
    "valido.glb",
    "valido-textura.glb",
    "--profile",
    profile,
    "--out",
    "-",
  ];
  const comparePassJson = await command(comparePass, 0);
  assert.equal(comparePassJson, await command(comparePass, 0));
  assert.deepEqual(JSON.parse(comparePassJson).verdicts, {
    before: true,
    after: true,
  });
  const compareFail = await command(
    [
      "compare",
      "valido.glb",
      "quebrado.glb",
      "--profile",
      profile,
      "--out",
      "-",
    ],
    1,
  );
  assert.equal(JSON.parse(compareFail).verdicts.after, false);
  await command(
    ["compare", "missing.glb", "valido.glb", "--profile", profile, "--out", "-"],
    2,
  );
  await command(["compare", "valido.glb", "quebrado.glb"], 2);
  await mkdir(join(cwd, "profiles"));
  await copyFile(profile, join(cwd, "profiles/default.json"));
  const client = new Client({ name: "release-check", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp", "--root", cwd],
        stderr: "pipe",
      }),
    );
    const result = await client.callTool({
      name: "judge_asset",
      arguments: { asset: "valido.glb", profile: "profiles/default.json" },
    });
    assert.equal(result.structuredContent.report.verdict.pass, true);
  } finally {
    await client.close();
  }
  const app = spawn(process.execPath, [cli, "app", "--port", "0"], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let timer;
  try {
    const url = await new Promise((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error("The app did not start within 10 seconds.")),
        10_000,
      );
      app.once("error", reject);
      app.once("exit", (code) => reject(new Error(`App exited: ${code}`)));
      let output = "";
      app.stdout.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) resolve(match[0]);
      });
    });
    clearTimeout(timer);
    const home = await fetch(url);
    assert.equal(home.status, 200);
    const html = await home.text();
    const script = html.match(/src="([^"]+\.js)"/)[1];
    assert(html.includes('lang="en"'));
    const javascript = await fetch(new URL(script, url));
    assert.equal(javascript.status, 200);
    const bundle = await javascript.text();
    assert(bundle.includes("Judge asset"));
    assert(!bundle.includes("Português (Brasil)"));
    const form = new FormData();
    form.set(
      "asset",
      new File([await readFile(join(cwd, "quebrado.glb"))], "quebrado.glb"),
    );
    form.set("profile", "web-commerce.json");
    const result = await (
      await fetch(`${url}/api/judge`, { method: "POST", body: form })
    ).json();
    assert.equal(result.exitHint, 1);
    assert.equal(result.report.verdict.pass, false);
  } finally {
    clearTimeout(timer);
    if (app.exitCode === null) {
      const ended = once(app, "exit");
      app.kill("SIGTERM");
      await ended;
    }
  }
  await writeFile(
    join(
      artifacts,
      registry ? "registry-verification.json" : "verification.json",
    ),
    JSON.stringify(
      {
        node: process.version,
        source: registry ? "npm-registry" : "local-tarballs",
        checks: [
          "tarball-integrity",
          "license-and-notices",
          "clean-install",
          "cli-exits-0-1-2",
          "compare-exits-0-1-2",
          "determinism",
          "mcp-stdio",
          "http-ui",
          "http-judge",
        ],
        packages,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(
    "Clean installation: CLI, MCP, app, determinism and exit codes passed.\n",
  );
} finally {
  await rm(cwd, { recursive: true, force: true });
}
