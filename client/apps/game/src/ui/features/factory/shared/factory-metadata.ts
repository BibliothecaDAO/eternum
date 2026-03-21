import type { RawArgsArray } from "starknet";

import { getGameManifest, type Chain } from "../../../../../../../../contracts/utils/utils";

type FactoryConfigGameMode = "eternum" | "blitz";

export interface FactoryManifestContract {
  class_hash: string;
  tag: string;
  selector: string;
  init_calldata?: RawArgsArray;
  address?: string;
}

export interface FactoryManifestModel {
  class_hash: string;
  tag?: string;
  selector?: string;
}

export interface FactoryManifestEvent {
  class_hash: string;
  tag?: string;
  selector?: string;
}

export interface FactoryManifestLibrary {
  class_hash: string;
  tag?: string;
  version?: string;
  name?: string;
}

export interface FactoryConfigManifest {
  world: {
    class_hash: string;
    seed?: string;
    name?: string;
    address?: string;
  };
  contracts: FactoryManifestContract[];
  models: FactoryManifestModel[];
  events: FactoryManifestEvent[];
  libraries?: FactoryManifestLibrary[];
}

const DEFAULT_FACTORY_VERSION_BY_MODE: Record<FactoryConfigGameMode, string> = {
  eternum: "180",
  blitz: "180",
};

function readOptionalFactoryEnv(name: string): string | undefined {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.[name];
}

const CARTRIDGE_API_BASE = readOptionalFactoryEnv("VITE_PUBLIC_CARTRIDGE_API_BASE") || "https://api.cartridge.gg";
const EXPLORER_MAINNET = readOptionalFactoryEnv("VITE_PUBLIC_EXPLORER_MAINNET") || "https://voyager.online";
const EXPLORER_SEPOLIA = readOptionalFactoryEnv("VITE_PUBLIC_EXPLORER_SEPOLIA") || "https://sepolia.voyager.online";

const SLOT_EXPLORER_BASE_BY_CHAIN: Partial<Record<Chain, string>> = {
  slot: `${CARTRIDGE_API_BASE}/x/eternum-blitz-slot-4/katana/explorer`,
  slottest: `${CARTRIDGE_API_BASE}/x/eternum-blitz-slot-test/katana/explorer`,
};

export const DEFAULT_FACTORY_NAMESPACE = "s1_eternum";

export const FACTORY_ADDRESSES: Record<Chain, string> = {
  sepolia: "0x07A6F094f15f8C18704bfb19fFEBCBC70b87e41674dE97EbeC7cb7Ffe5c9581B",
  slot: "0x242226ce5f17914fc148cb111980b24e2bda624379877cda66f7e76884d2deb",
  local: "",
  mainnet: "0x525410a4d0ebd4a313e2125ac986710cd8f1bd08d47379b7f45c8b9c71b4da",
  slottest: "",
};

export const resolveFactoryConfigDefaultVersion = (gameMode: FactoryConfigGameMode): string =>
  DEFAULT_FACTORY_VERSION_BY_MODE[gameMode];

export const resolveFactoryAddress = (chain: Chain): string => FACTORY_ADDRESSES[chain];

export const getFactoryConfigManifest = (chain: Chain): FactoryConfigManifest =>
  getGameManifest(chain) as unknown as FactoryConfigManifest;

export const loadFactoryConfigManifest = async (chain: Chain): Promise<FactoryConfigManifest> =>
  getFactoryConfigManifest(chain);

export const getFactoryExplorerTxUrl = (chain: Chain, txHash: string) => {
  const slotExplorerBase = SLOT_EXPLORER_BASE_BY_CHAIN[chain];
  if (slotExplorerBase) {
    return `${slotExplorerBase}/tx/${txHash}`;
  }

  if (chain === "sepolia") {
    return `${EXPLORER_SEPOLIA}/tx/${txHash}`;
  }

  return `${EXPLORER_MAINNET}/tx/${txHash}`;
};
