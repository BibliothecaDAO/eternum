import { normalizeSelector } from "./normalize";

type AnyManifest = any;

export const patchManifestWithFactory = (
  baseManifest: AnyManifest,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): AnyManifest => {
  const manifest = JSON.parse(JSON.stringify(baseManifest));

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
