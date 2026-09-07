/** Types for the official Khronos Dart binding, 2.0.0-dev.3.10. ESM exports version/supportedExtensions as functions; info can be absent when asset.version is invalid. */
declare module "gltf-validator" {
  /** 0 Error, 1 Warning, 2 Information, 3 Hint. */
  export type GltfIssueSeverity = 0 | 1 | 2 | 3;

  export type GltfIssue = {
    code: string;
    message: string;
    severity: GltfIssueSeverity;
    /** glTF JSON pointer; container-level diagnostics may omit it. */
    pointer?: string;
    /** Container byte offset. */
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
    /** Absent when the validator cannot parse a valid asset.version. */
    info?: GltfValidationInfo;
  };

  export type ValidationOptions = {
    uri?: string;
    format?: "glb" | "gltf";
    externalResourceFunction?: (uri: string) => Promise<Uint8Array>;
    writeTimestamp?: boolean;
    /** Zero means unlimited. */
    maxIssues?: number;
    ignoredIssues?: string[];
    /** Cannot be combined with ignoredIssues. */
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
