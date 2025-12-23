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
    manifest.contracts = manifest.contracts.map((contract: any) => {
      if (!contract?.selector) return contract;
      const key = normalizeSelector(contract.selector);
      const address = contractsBySelector[key];
      return address ? { ...contract, address } : contract;
    });
  }

  return manifest;
};
