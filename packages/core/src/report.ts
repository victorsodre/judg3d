import type { LayerKind, Verdict } from "./contract.js";

/**
 * Envelope do `judge-report.json`. O Verdict e o contrato da spec e fica
 * intacto la dentro; a proveniencia que o invariante 1 exige — hash do asset,
 * hash do profile, versao do engine — mora aqui fora.
 *
 * Sem timestamp por padrao: com (assetHash, profileHash, engineVersion) iguais
 * o arquivo sai byte a byte igual, e o diff no PR mostra so o que mudou de
 * verdade. `--timestamp` opta por incluir.
 */
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
  generatedAt?: string;
  verdict: Verdict;
};

/** JSON com quebra de linha final, pronto pra gravar e pra diff. */
export function serializeReport(report: JudgeReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
