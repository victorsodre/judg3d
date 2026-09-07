/** Enable ANSI only for a TTY when NO_COLOR is absent. */

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

/** Asset data must not inject terminal controls or status lines. */
export function terminalText(text: string): string {
  return text.replace(
    /[\p{Cc}\p{Cf}]/gu,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

// Shared formatting comes from the browser-safe core presentation module.

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
