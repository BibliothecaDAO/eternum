export type ChainType = "local" | "sepolia" | "mainnet" | "slot" | "slottest";

interface ManifestContract {
  class_hash: string;
  tag: string;
  selector: string;
  init_calldata?: any[];
  address?: string;
}

interface ManifestModel {
  class_hash: string;
  tag: string;
  selector: string;
}

interface ManifestEvent {
  class_hash: string;
  tag: string;
  selector: string;
}

interface ManifestData {
  world: {
    class_hash: string;
    seed: string;
    name?: string;
    address?: string;
  };
  contracts: ManifestContract[];
  models: ManifestModel[];
  events: ManifestEvent[];
}

const MANIFEST_LOADERS: Record<ChainType, () => Promise<ManifestData>> = {
  local: async () => (await import("@manifests/manifest_local.json")).default as ManifestData,
  sepolia: async () => (await import("@manifests/manifest_sepolia.json")).default as ManifestData,
  mainnet: async () => (await import("@manifests/manifest_mainnet.json")).default as ManifestData,
  slot: async () => (await import("@manifests/manifest_slot.json")).default as ManifestData,
  slottest: async () => (await import("@manifests/manifest_slottest.json")).default as ManifestData,
};

const manifestCache = new Map<ChainType, ManifestData>();

const loadManifestFromSource = async (chain: ChainType): Promise<ManifestData | null> => {
  const cached = manifestCache.get(chain);
  if (cached) {
    return cached;
  }

  const loader = MANIFEST_LOADERS[chain];
  if (!loader) {
    return null;
  }

  const manifest = await loader();
  manifestCache.set(chain, manifest);
  return manifest;
};

export const getManifestJsonString = async (chain: ChainType): Promise<string> => {
  const manifest = await loadManifestFromSource(chain);
  return manifest ? JSON.stringify(manifest, null, 2) : "";
};
