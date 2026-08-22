/**
 * Formatacao da saida humana. Sem dependencia de cor: ANSI so quando a saida e
 * um terminal e `NO_COLOR` nao esta setada.
 */

const CSI = "\u001B[";
const RESET = `${CSI}0m`;

const enabled = process.stdout.isTTY && process.env["NO_COLOR"] === undefined;

function wrap(code: number, text: string): string {
  return enabled ? `${CSI}${code}m${text}${RESET}` : text;
}

export const dim = (text: string): string => wrap(2, text);
export const bold = (text: string): string => wrap(1, text);
export const red = (text: string): string => wrap(31, text);
export const yellow = (text: string): string => wrap(33, text);
export const green = (text: string): string => wrap(32, text);

// `formatBytes` mora em `@judg3d/core/present`, compartilhado com a app local.
// Duas copias divergiram uma vez: o mesmo asset saia `1,6 KB` aqui e `1.6 KB`
// na UI.

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
