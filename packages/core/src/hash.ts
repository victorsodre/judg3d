import { createHash } from "node:crypto";

/** Hash the original bytes, including profile whitespace; do not normalize JSON. */
export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Display helpers live in the browser-safe present.ts module.
