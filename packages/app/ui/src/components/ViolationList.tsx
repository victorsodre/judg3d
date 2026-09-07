import { useLocale } from "../locale.js";
import { useMemo, useState } from "react";
import { violationDetail } from "../api";
import type { Violation } from "../types";

type ViolationListProps = {
  violations: Violation[];
};

export function ViolationList({ violations }: ViolationListProps) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      violations.filter((item) =>
        `${item.code} ${item.nodePath ?? ""} ${violationDetail(item, locale) ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [violations, query, locale],
  );
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  if (violations.length === 0) {
    return <p className="empty-note">{t.noViolations}</p>;
  }

  return (
    <>
      <div className="violation-tools">
        <label className="field">
          {t.filter}
          <input
            type="search"
            className="field__control"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <p>
          {filtered.length} {t.of} {violations.length} {t.occurrences} ·{" "}
          {t.page} {currentPage + 1} {t.of} {pages}
        </p>
      </div>
      <ul className="violations">
        {filtered
          .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
          .map((violation, index) => {
            const message = violationDetail(violation, locale);
            return (
              <li
                key={`${currentPage}:${index}`}
                className={`violation violation--${violation.severity}`}
              >
                <div className="violation__head">
                  <span className="violation__sev">
                    {violation.severity === "error" ? t.error : t.warning}
                  </span>
                  <span className="violation__kind">{violation.kind}</span>
                  <code className="violation__code">{violation.code}</code>
                </div>
                {violation.nodePath !== undefined ? (
                  <code className="violation__path">
                    {violation.nodePath || t.document}
                  </code>
                ) : null}
                {message !== undefined ? (
                  <p className="violation__msg">{message}</p>
                ) : null}
              </li>
            );
          })}
      </ul>
      {pages > 1 ? (
        <nav className="violation-tools" aria-label={t.pages}>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={currentPage === 0}
            onClick={() => {
              setPage(currentPage - 1);
            }}
          >
            {t.previous}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={currentPage + 1 >= pages}
            onClick={() => {
              setPage(currentPage + 1);
            }}
          >
            {t.next}
          </button>
        </nav>
      ) : null}
    </>
  );
}
