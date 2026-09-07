/** Stable exit codes distinguish acceptance, rejection and infrastructure failure. */
export const EXIT_PASS = 0;
export const EXIT_FAIL = 1;
export const EXIT_INFRA = 2;

export type ExitCode = typeof EXIT_PASS | typeof EXIT_FAIL | typeof EXIT_INFRA;
