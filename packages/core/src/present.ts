import type { Violation } from "./contract.js";

/**
 * Apresentacao compartilhada entre as superficies — CLI, app local e o que
 * vier depois.
 *
 * **Este e o unico modulo do core que nao importa nada de `node:`**, e a regra
 * nao e estetica: ele e publicado no subpath `@judg3d/core/present` justamente
 * para que o browser possa importar VALOR daqui. Importar do root puxaria
 * `profile.ts` (`node:fs/promises`) e `hash.ts` (`node:crypto`) para o bundle.
 *
 * Se voce precisar de `node:` aqui, a funcao nao pertence a este arquivo.
 *
 * Ele existe porque as duas superficies tinham copias divergentes: o mesmo
 * asset aparecia como `1,6 KB` no CLI e `1.6 KB` na UI, e uma violacao sem
 * `message` ficava sem numero nos dois lugares por implementacoes separadas do
 * mesmo invariante.
 */

/** Tamanho legivel, em pt-BR — separador decimal e virgula. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1).replace(".", ",")} KB`;
  }
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Prefixo curto de um hash, para exibicao humana. */
export function shortHash(hex: string): string {
  return hex.slice(0, 12);
}

/**
 * A linha de detalhe de uma violacao: o que se leu, e o que se esperava.
 *
 * Invariante 4 da spec — toda violacao e acionavel: codigo, local e
 * `got`/`want`. O codigo sozinho nao e acionavel: `MATERIALS_OVER_BUDGET` nao
 * diz se o asset tem 21 materiais ou 350.
 *
 * Ate a L2 existir, TODA violacao vinha da L1 e trazia `got.message`, entao as
 * duas superficies so sabiam renderizar mensagem. O buraco estava aberto desde
 * o inicio e so apareceu quando a primeira violacao sem `message` chegou — um
 * invariante que nunca foi exercido nao esta garantido.
 */
export function violationDetail(violation: Violation): string | undefined {
  return messageOf(violation.got) ?? comparison(violation);
}

/** A mensagem que a camada escreveu, quando ela escreveu uma. */
export function messageOf(got: unknown): string | undefined {
  if (typeof got === "object" && got !== null && "message" in got) {
    const { message } = got;
    if (typeof message === "string") {
      return message;
    }
  }
  return undefined;
}

function comparison(violation: Violation): string | undefined {
  const got = flatten(violation.got);
  if (got === undefined) {
    return undefined;
  }
  // Pares identicos nos dois lados sao contexto repetido, nao contraste.
  const want = flatten(violation.want, asRecord(violation.got));
  return want === undefined ? got : `${got}  →  esperado ${want}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function flatten(
  value: unknown,
  omitSameAs: Record<string, unknown> = {},
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => flatten(item) ?? "—").join(", ");
  }
  if (typeof value === "object") {
    const parts = Object.entries(value)
      .filter(([key, item]) => item !== undefined && omitSameAs[key] !== item)
      .map(([key, item]) => `${key} ${flatten(item) ?? "—"}`);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }
  // `got` e `want` sao `unknown` no contrato de proposito — cada camada poe o
  // que faz sentido. Sem lista explicita, um objeto exotico viraria
  // "[object Object]" na saida, que e pior que nao imprimir nada.
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  return undefined;
}
