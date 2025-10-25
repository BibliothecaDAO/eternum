import manifestLocal from "@manifests/manifest_local.json";
import manifestSepolia from "@manifests/manifest_sepolia.json";
import manifestMainnet from "@manifests/manifest_mainnet.json";
import manifestSlot from "@manifests/manifest_slot.json";
import manifestSlottest from "@manifests/manifest_slottest.json";

export type ChainType = "local" | "sepolia" | "mainnet" | "slot" | "slottest";

export interface ManifestContract {
  class_hash: string;
  tag: string;
  selector: string;
  init_calldata?: any[];
  address?: string;
}

export interface ManifestModel {
  class_hash: string;
  tag: string;
  selector: string;
}

export interface ManifestEvent {
  class_hash: string;
  tag: string;
  selector: string;
}

export interface ManifestData {
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

const MANIFESTS: Record<ChainType, ManifestData> = {
  local: manifestLocal as ManifestData,
  sepolia: manifestSepolia as ManifestData,
  mainnet: manifestMainnet as ManifestData,
  slot: manifestSlot as ManifestData,
  slottest: manifestSlottest as ManifestData,
};

export const loadManifestFromSource = (chain: ChainType): ManifestData | null => {
  return MANIFESTS[chain] || null;
};

export const getManifestJsonString = (chain: ChainType): string => {
  const manifest = loadManifestFromSource(chain);
  return manifest ? JSON.stringify(manifest, null, 2) : "";
};
