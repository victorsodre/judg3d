import { InfraError } from "@judg3d/core";

import { terminalText } from "./format.js";

export type InfraSink = {
  stderr: (line: string) => void;
};

export function reportInfraFailure(error: unknown, context: InfraSink): void {
  if (error instanceof InfraError) {
    context.stderr(`judg3d: ${terminalText(error.message)}`);
    if (error.detail !== undefined) {
      context.stderr(terminalText(error.detail));
    }
  } else {
    context.stderr(
      `judg3d: unexpected failure — ${terminalText(error instanceof Error ? error.message : String(error))}`,
    );
  }
  context.stderr(
    "This is an infrastructure failure (exit 2), not an asset rejection.",
  );
}
