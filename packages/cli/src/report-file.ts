import { lstat, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { InfraError } from "@judg3d/core";

export async function assertReportDestination(
  path: string,
  inputs: readonly string[],
): Promise<void> {
  if (path === "-") return;
  const canonical = join(
    await realpath(dirname(resolve(path))),
    basename(resolve(path)),
  );
  const destination = await lstat(path).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  });
  if (destination !== undefined && !destination.isFile()) {
    throw new InfraError(
      "The report destination must be a regular file, not a symbolic link.",
    );
  }
  for (const input of inputs) {
    const info = await stat(input).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    });
    if (info === undefined) {
      continue;
    }
    if (
      (await realpath(input)) === canonical ||
      (destination?.dev === info.dev && destination.ino === info.ino)
    ) {
      throw new InfraError(
        "The report must not overwrite the asset or profile.",
      );
    }
  }
}

export async function writeReport(
  path: string,
  contents: string,
  inputs: readonly string[],
): Promise<void> {
  if (path === "-") return;
  await writeAtomic(path, contents, inputs, `Could not write report to ${path}`);
}

/** Atomically write binary bytes without clobbering the asset or profile. */
export async function writeBinary(
  path: string,
  contents: Uint8Array,
  inputs: readonly string[],
): Promise<void> {
  await writeAtomic(
    path,
    contents,
    inputs,
    `Could not write repaired asset to ${path}`,
  );
}

async function writeAtomic(
  path: string,
  contents: string | Uint8Array,
  inputs: readonly string[],
  failure: string,
): Promise<void> {
  const temporary = join(dirname(resolve(path)), `.judg3d-${randomUUID()}.tmp`);
  try {
    await assertReportDestination(path, inputs);
    await writeFile(temporary, contents, {
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, path);
  } catch (cause) {
    if (cause instanceof InfraError) throw cause;
    throw new InfraError(
      failure,
      cause instanceof Error ? cause.message : String(cause),
    );
  } finally {
    await rm(temporary, { force: true });
  }
}
