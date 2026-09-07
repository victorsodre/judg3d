import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { InfraError } from "./errors.js";

export const MAX_ASSET_BYTES = 64 * 1024 * 1024;
export const MAX_PROFILE_BYTES = 1024 * 1024;

/** Bounded regular-file reads remain bounded if the file grows during reading. */
export async function readBoundedFile(
  path: string,
  limit: number,
): Promise<Buffer> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new InfraError("Input must be a regular file.");
    if (stat.size > limit)
      throw new InfraError(`File exceeds the ${limit}-byte limit.`);
    const chunks: Buffer[] = [];
    let total = 0;
    while (total <= limit) {
      const buffer = Buffer.alloc(Math.min(64 * 1024, limit + 1 - total));
      const { bytesRead } = await file.read(buffer);
      if (bytesRead === 0) return Buffer.concat(chunks, total);
      total += bytesRead;
      if (total > limit) break;
      chunks.push(buffer.subarray(0, bytesRead));
    }
    throw new InfraError(`File exceeds the ${limit}-byte limit.`);
  } finally {
    await file.close();
  }
}
