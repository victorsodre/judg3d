import { createHash } from "node:crypto";

/**
 * sha256 em hex dos bytes crus. O hash do profile e o do arquivo como esta
 * em disco, nao de um JSON normalizado: se o arquivo muda, o hash muda, e a
 * tupla (assetHash, profileHash, engineVersion) do invariante 1 continua
 * dizendo a verdade.
 */
export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// `shortHash` mudou para `present.ts`: ele nao precisa de `node:crypto` e o
// browser precisa dele. Continua exportado pelo root do pacote.
