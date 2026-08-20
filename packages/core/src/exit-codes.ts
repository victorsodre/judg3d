/**
 * Exit codes do judg3d. Distintos de proposito: um CI que trata "!= 0" como
 * reprovacao ainda funciona, e um que quer separar infra de veredito tambem.
 */
export const EXIT_PASS = 0;
export const EXIT_FAIL = 1;
export const EXIT_INFRA = 2;

export type ExitCode = typeof EXIT_PASS | typeof EXIT_FAIL | typeof EXIT_INFRA;
