import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Versao lida do package.json em runtime, e nao uma constante copiada: o
 * relatorio assina qual judg3d produziu o veredito, entao esse numero nao pode
 * divergir do que foi publicado.
 */
const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  version: string;
};

export const CLI_VERSION: string = manifest.version;
