/**
 * Invariante 3 da spec: falha de infra nunca vira reprovacao, e reprovacao
 * nunca vira falha de infra. Sao dois exit codes distintos e nenhum caminho
 * imprime "passou" sem um Verdict computado.
 */
export class InfraError extends Error {
  override readonly name = "InfraError";
  readonly detail: string | undefined;

  constructor(message: string, detail?: string) {
    super(message);
    this.detail = detail;
  }
}

export function isInfraError(value: unknown): value is InfraError {
  return value instanceof InfraError;
}
