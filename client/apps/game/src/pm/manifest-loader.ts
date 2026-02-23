export type PredictionMarketChain = "slot" | "mainnet";

export interface PredictionMarketManifestContract {
  tag: string;
  address?: string;
}

export interface PredictionMarketManifest {
  world: {
    address: string;
  };
  contracts: PredictionMarketManifestContract[];
}

const MANIFEST_LOADERS: Record<PredictionMarketChain, () => Promise<PredictionMarketManifest>> = {
  slot: async () => (await import("./manifests/manifest_slot.json")).default as PredictionMarketManifest,
  mainnet: async () => (await import("./manifests/manifest_mainnet_1-7.json")).default as PredictionMarketManifest,
};

const manifestCache = new Map<PredictionMarketChain, PredictionMarketManifest>();

export const loadPredictionMarketManifest = async (chain: PredictionMarketChain): Promise<PredictionMarketManifest> => {
  const cachedManifest = manifestCache.get(chain);
  if (cachedManifest) {
    return cachedManifest;
  }

  const loader = MANIFEST_LOADERS[chain];
  if (!loader) {
    throw new Error(`Unsupported prediction market chain: ${chain}`);
  }

  const manifest = await loader();
  manifestCache.set(chain, manifest);
  return manifest;
};
