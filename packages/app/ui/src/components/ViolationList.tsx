import { violationDetail } from "../api";
import type { Violation } from "../types";

type ViolationListProps = {
  violations: Violation[];
};

export function ViolationList({ violations }: ViolationListProps) {
  if (violations.length === 0) {
    return (
      <p className="empty-note">Nenhuma violação. O asset passou limpo.</p>
    );
  }

  return (
    <ul className="violations">
      {violations.map((violation) => {
        // `violationDetail`, e nao so a mensagem: uma violacao de orcamento
        // nao traz `message`, e mostrar so o codigo esconde o numero que a
        // torna acionavel.
        const message = violationDetail(violation);
        return (
          <li
            key={`${violation.code}:${violation.nodePath ?? ""}:${message ?? ""}`}
            className={`violation violation--${violation.severity}`}
          >
            <div className="violation__head">
              <span className="violation__sev">
                {violation.severity === "error" ? "erro" : "aviso"}
              </span>
              <span className="violation__kind">{violation.kind}</span>
              <code className="violation__code">{violation.code}</code>
            </div>
            {violation.nodePath !== undefined ? (
              <code className="violation__path">{violation.nodePath}</code>
            ) : null}
            {message !== undefined ? (
              <p className="violation__msg">{message}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
