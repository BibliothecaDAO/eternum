import type { RawArgsArray } from "starknet";

import {
  resolveFactoryConfigDefaultVersion as resolveSharedFactoryConfigDefaultVersion,
  type FactoryDefaultVersionGameMode,
} from "../../../../../../../config/shared/factory-defaults";
import { getGameManifest, type Chain } from "../../../../../../../contracts/utils/utils";

type FactoryConfigGameMode = FactoryDefaultVersionGameMode;

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

function readOptionalFactoryEnv(name: string): string | undefined {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.[name];
}

const EXPLORER_MAINNET = readOptionalFactoryEnv("VITE_PUBLIC_EXPLORER_MAINNET") || "https://voyager.online";
const EXPLORER_SEPOLIA = readOptionalFactoryEnv("VITE_PUBLIC_EXPLORER_SEPOLIA") || "https://sepolia.voyager.online";

export const DEFAULT_FACTORY_NAMESPACE = "s1_eternum";

export const FACTORY_ADDRESSES: Record<Chain, string> = {
  sepolia: "0x07A6F094f15f8C18704bfb19fFEBCBC70b87e41674dE97EbeC7cb7Ffe5c9581B",
  local: "",
  mainnet: "0x525410a4d0ebd4a313e2125ac986710cd8f1bd08d47379b7f45c8b9c71b4da",
  appchain: "0x4c50ced3c1fd6f2f4cef779e28adafb234ed9773dda3e0e39918f24f2936350",
};

export const resolveFactoryConfigDefaultVersion = (gameMode: FactoryConfigGameMode): string =>
  resolveSharedFactoryConfigDefaultVersion(gameMode);

export const resolveFactoryAddress = (chain: Chain): string => FACTORY_ADDRESSES[chain];

export const getFactoryConfigManifest = (chain: Chain): FactoryConfigManifest =>
  getGameManifest(chain) as unknown as FactoryConfigManifest;

export const loadFactoryConfigManifest = async (chain: Chain): Promise<FactoryConfigManifest> =>
  getFactoryConfigManifest(chain);

export const getFactoryExplorerTxUrl = (chain: Chain, txHash: string) => {
  if (chain === "sepolia") {
    return `${EXPLORER_SEPOLIA}/tx/${txHash}`;
  }

  return `${EXPLORER_MAINNET}/tx/${txHash}`;
};
