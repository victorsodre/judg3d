import { formatBytes, shortHash } from "../api";
import type { JudgeReport } from "../types";

import { MetricsBar } from "./MetricsBar";
import { ViolationList } from "./ViolationList";

type VerdictPanelProps = {
  report: JudgeReport;
  serialized: string;
};

export function VerdictPanel({ report, serialized }: VerdictPanelProps) {
  const { verdict } = report;
  const errors = verdict.violations.filter((v) => v.severity === "error").length;
  const warns = verdict.violations.filter((v) => v.severity === "warn").length;

  function downloadReport(): void {
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "judge-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={`verdict${verdict.pass ? " verdict--pass" : " verdict--fail"}`} aria-live="polite">
      <header className="verdict__banner">
        <p className="verdict__stamp">{verdict.pass ? "aprovado" : "reprovado"}</p>
        <p className="verdict__counts">
          {errors} {errors === 1 ? "erro" : "erros"} · {warns}{" "}
          {warns === 1 ? "aviso" : "avisos"}
        </p>
      </header>

      <div className="verdict__meta">
        <span>
          {report.asset.uri} · {formatBytes(report.asset.bytes)} · sha256{" "}
          <code>{shortHash(report.asset.sha256)}</code>
        </span>
        <span>
          perfil {report.profile.id}@{report.profile.version} · validator{" "}
          {report.engine.gltfValidator}
        </span>
      </div>

      <MetricsBar metrics={verdict.metrics} layers={report.engine.layers} />
      <ViolationList violations={verdict.violations} />

      <div className="verdict__actions">
        <button type="button" className="btn btn--ghost" onClick={downloadReport}>
          Baixar judge-report.json
        </button>
      </div>
    </section>
  );
}
