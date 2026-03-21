import type { Chain } from "@contracts";

import { loadFactoryConfigManifest, type FactoryConfigManifest } from "@/ui/features/factory/shared/factory-metadata";

export type ChainType = Chain;

export type ManifestSourceLoader = (chain: ChainType) => Promise<FactoryConfigManifest | null>;

export const getManifestJsonString = async (
  chain: ChainType,
  manifestSourceLoader: ManifestSourceLoader = loadFactoryConfigManifest,
): Promise<string> => {
  try {
    const manifest = await manifestSourceLoader(chain);
    return manifest ? JSON.stringify(manifest, null, 2) : "";
  } catch (error) {
    console.error(`[admin-manifest-loader] Failed to load manifest for chain '${chain}'`, error);
    return "";
  }
};
