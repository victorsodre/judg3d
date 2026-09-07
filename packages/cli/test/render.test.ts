import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { loadProfile } from "@judg3d/core";
import { judge, readAsset } from "@judg3d/judge";
import { renderReport } from "../src/render.js";

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
