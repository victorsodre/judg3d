import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Read the runtime package version instead of maintaining a duplicate constant. */
const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  version: string;
};

export const CLI_VERSION: string = manifest.version;
