import type { LayerKind, Verdict } from "./contract.js";

/** Report provenance: input hashes and engine versions. Timestamps are opt-in to preserve determinism. */
export type JudgeReport = {
  judg3dVersion: string;
  asset: {
    uri: string;
    sha256: string;
    bytes: number;
  };
  profile: {
    id: string;
    version: string;
    sha256: string;
  };
  engine: {
    gltfValidator: string;
    node: string;
    layers: LayerKind[];
  };
  /** Unperformed layers are not passed checks. */
  coverage: {
    ran: LayerKind[];
    skipped: LayerKind[];
  };
  generatedAt?: string;
  verdict: Verdict;
};

/** Stable JSON serialization with a trailing newline. */
export function serializeReport(report: JudgeReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
