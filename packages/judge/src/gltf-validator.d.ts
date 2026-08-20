/**
 * Declaracao de tipos do pacote oficial `gltf-validator` da Khronos, que e
 * compilado de Dart e nao publica tipos (`@types/gltf-validator` nao existe).
 *
 * Escrito a partir de `module.mjs` e de `lib/src/validation_result.dart` na
 * versao 2.0.0-dev.3.10. Duas coisas que a documentacao em prosa nao deixa
 * claras e valem o comentario:
 *
 *  - No build ESM, `version` e `supportedExtensions` sao FUNCOES, nao valores.
 *  - `report.info` some inteiro quando `asset.version` e invalido, por isso e
 *    opcional aqui.
 */
declare module "gltf-validator" {
  /** 0 = Error, 1 = Warning, 2 = Information, 3 = Hint. */
  export type GltfIssueSeverity = 0 | 1 | 2 | 3;

  export type GltfIssue = {
    code: string;
    message: string;
    severity: GltfIssueSeverity;
    /** JSON pointer dentro do glTF. Ausente em problemas do container GLB. */
    pointer?: string;
    /** Byte offset. Presente em problemas do container GLB. */
    offset?: number;
  };

  export type GltfResource = {
    pointer: string;
    mimeType?: string;
    storage?: string;
    uri?: string;
    byteLength?: number;
    image?: {
      width?: number;
      height?: number;
      format?: string;
      primaries?: string;
      transfer?: string;
      bits?: number;
    };
  };

  export type GltfValidationInfo = {
    version: string;
    minVersion?: string;
    generator?: string;
    extensionsUsed?: string[];
    extensionsRequired?: string[];
    resources?: GltfResource[];
    animationCount: number;
    materialCount: number;
    hasMorphTargets: boolean;
    hasSkins: boolean;
    hasTextures: boolean;
    hasDefaultScene: boolean;
    drawCallCount: number;
    totalVertexCount: number;
    totalTriangleCount: number;
    maxUVs: number;
    maxInfluences: number;
    maxAttributes: number;
  };

  export type GltfValidationReport = {
    uri?: string;
    mimeType?: string;
    validatorVersion: string;
    validatedAt?: string;
    issues: {
      numErrors: number;
      numWarnings: number;
      numInfos: number;
      numHints: number;
      messages: GltfIssue[];
      truncated: boolean;
    };
    /** Ausente quando o asset nao tem `asset.version` valido. */
    info?: GltfValidationInfo;
  };

  export type ValidationOptions = {
    uri?: string;
    format?: "glb" | "gltf";
    externalResourceFunction?: (uri: string) => Promise<Uint8Array>;
    writeTimestamp?: boolean;
    /** 0 = ilimitado. */
    maxIssues?: number;
    ignoredIssues?: string[];
    /** Nao pode ser usado junto com `ignoredIssues`. */
    onlyIssues?: string[];
    severityOverrides?: Record<string, number>;
  };

  export function version(): string;
  export function supportedExtensions(): string[];
  export function validateBytes(
    data: Uint8Array,
    options?: ValidationOptions,
  ): Promise<GltfValidationReport>;
  export function validateString(
    json: string,
    options?: ValidationOptions,
  ): Promise<GltfValidationReport>;
}
