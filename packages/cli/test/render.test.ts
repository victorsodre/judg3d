import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { compareReports, loadProfile } from "@judg3d/core";
import { judge, readAsset } from "@judg3d/judge";
import { renderCompare, renderReport } from "../src/render.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));

it("laudo grande não estoura a pilha nem inunda o terminal", async () => {
  const { report } = await judge(
    await readAsset(`${root}fixtures/quebrado.glb`),
    await loadProfile(`${root}profiles/web-commerce.json`),
    { judg3dVersion: "test" },
  );
  const violation = report.verdict.violations[0];
  if (violation === undefined) throw new Error("Fixture sem violações.");
  report.verdict.violations = Array.from({ length: 150_000 }, () => violation);
  const rendered = renderReport(report, "report.json");
  expect(rendered).toContain("149800 additional occurrences");
  expect(rendered.length).toBeLessThan(100_000);
  expect(report.verdict.violations).toHaveLength(150_000);
});

it("escapa controles presentes nos dados sem modificar o JSON", async () => {
  const { report } = await judge(
    await readAsset(`${root}fixtures/valido.glb`),
    await loadProfile(`${root}profiles/web-commerce.json`),
    { judg3dVersion: "test" },
  );
  report.asset.uri = "evil\u001b[2J\nPASSED.glb";
  const rendered = renderReport(report, "report.json");
  expect(rendered).toContain("evil\\u001b[2J\\u000aPASSED.glb");
  expect(report.asset.uri).toContain("\u001b");
});

it("compare summary escapes asset names and keeps skipped layers honest", async () => {
  const profile = await loadProfile(`${root}profiles/web-commerce.json`);
  const before = await judge(
    await readAsset(`${root}fixtures/valido.glb`),
    profile,
    { judg3dVersion: "test" },
  );
  const after = await judge(
    await readAsset(`${root}fixtures/quebrado.glb`),
    profile,
    { judg3dVersion: "test" },
  );
  after.report.asset.uri = "evil\u001b[2Jafter.glb";
  const rendered = renderCompare(
    compareReports(before.report, after.report),
    "compare-report.json",
  );
  expect(rendered).toContain("PASSED  →  FAILED");
  expect(rendered).toContain("UNRESOLVED_REFERENCE");
  expect(rendered).toContain("evil\\u001b[2Jafter.glb");
  expect(rendered).toContain("those layers are not PASS");
  expect(rendered).not.toContain("GEOMETRY passed");
});
