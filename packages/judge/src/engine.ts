import { supportedExtensions, version } from "gltf-validator";

/**
 * Versoes do runtime que assinam o veredito. A tupla (assetHash, profileHash,
 * engineVersion) do invariante 1 so vale se o engine se identificar.
 */
export function engineVersions(): {
  gltfValidator: string;
  gltfExtensions: string[];
  node: string;
} {
  return {
    gltfValidator: version(),
    gltfExtensions: supportedExtensions(),
    node: process.version,
  };
}
