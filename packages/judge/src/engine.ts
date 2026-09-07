import { supportedExtensions, version } from "gltf-validator";

/** Runtime versions included in report provenance. */
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
