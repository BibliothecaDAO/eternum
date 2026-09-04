import { normalizeSelector } from "./normalize";

type AnyManifest = any;

/**
 * Returns a new manifest with contract addresses overwritten from the factory map.
 * Also sets the world address.
 */
export const patchManifestWithFactory = (
  baseManifest: AnyManifest,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): AnyManifest => {
  const manifest = JSON.parse(JSON.stringify(baseManifest));

  // Patch world address if present
  if (manifest?.world) {
    manifest.world.address = worldAddress;
  }

  if (Array.isArray(manifest?.contracts)) {
    manifest.contracts = manifest.contracts.map((c: any) => {
      if (!c?.selector) return c;
      const key = normalizeSelector(c.selector);
      const addr = contractsBySelector[key];
      if (addr) {
        return { ...c, address: addr };
      }
      return c;
    });
  }

  return manifest;
};
