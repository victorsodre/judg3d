import { useLocale } from "../locale.js";
import { formatBytes, shortHash } from "../api";
import type { JudgeReport } from "../types";

import { MetricsBar } from "./MetricsBar";
import { ViolationList } from "./ViolationList";

type VerdictPanelProps = {
  report: JudgeReport;
  serialized: string;
};

export function VerdictPanel({ report, serialized }: VerdictPanelProps) {
  const { locale, t } = useLocale();
  const { verdict } = report;
  const errors = verdict.violations.filter(
    (v) => v.severity === "error",
  ).length;
  const warns = verdict.violations.filter((v) => v.severity === "warn").length;

  function downloadReport(): void {
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "judge-report.json";
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  return (
    <section
      className={`verdict${verdict.pass ? " verdict--pass" : " verdict--fail"}`}
      aria-live="polite"
    >
      <header className="verdict__banner">
        <p className="verdict__stamp">{verdict.pass ? t.pass : t.fail}</p>
        <p className="verdict__counts">
          {errors} {errors === 1 ? t.error : t.errors} · {warns}{" "}
          {warns === 1 ? t.warning : t.warnings}
        </p>
      </header>

      <div className="verdict__meta">
        <span>
          {report.asset.uri} · {formatBytes(report.asset.bytes, locale)} ·
          sha256 <code>{shortHash(report.asset.sha256)}</code>
        </span>
        <span>
          {t.profile} {report.profile.id}@{report.profile.version} · validator{" "}
          {report.engine.gltfValidator}
        </span>
      </div>

      <div className="verdict__coverage">
        <p>
          <strong>{t.verified}:</strong> {report.coverage.ran.join(" · ")}
        </p>
        <p>
          <strong>{t.skipped}:</strong>{" "}
          {report.coverage.skipped.join(" · ") || t.none}
        </p>
      </div>
      <MetricsBar metrics={verdict.metrics} />
      <p className="empty-note">{t.diagnostics}</p>
      <ViolationList violations={verdict.violations} />

      <div className="verdict__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={downloadReport}
        >
          {t.download}
        </button>
      </div>
    </section>
  );
}
