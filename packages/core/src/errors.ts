/** Infrastructure failures are distinct from asset rejection: exit 2 rather than exit 1. */
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
