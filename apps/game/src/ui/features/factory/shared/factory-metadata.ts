import type { RawArgsArray } from "starknet";

import {
  resolveFactoryConfigDefaultVersion as resolveSharedFactoryConfigDefaultVersion,
  type FactoryDefaultVersionGameMode,
} from "../../../../../../../config/shared/factory-defaults";
import { getGameManifest } from "../../../../../../../contracts/utils/utils";
import type { GameChain as Chain } from "@realms-world/chain";

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

const EXPLORER_APPCHAIN = readOptionalFactoryEnv("VITE_PUBLIC_EXPLORER_APPCHAIN");

export const DEFAULT_FACTORY_NAMESPACE = "s2";

export const FACTORY_ADDRESSES: Record<Chain, string> = {
  madara: "",
  appchain: "0x4c50ced3c1fd6f2f4cef779e28adafb234ed9773dda3e0e39918f24f2936350",
};

export const resolveFactoryConfigDefaultVersion = (gameMode: FactoryConfigGameMode): string =>
  resolveSharedFactoryConfigDefaultVersion(gameMode);

export const resolveFactoryAddress = (chain: Chain): string => FACTORY_ADDRESSES[chain];

const getFactoryConfigManifest = (chain: Chain): FactoryConfigManifest =>
  getGameManifest(chain) as unknown as FactoryConfigManifest;

export const loadFactoryConfigManifest = async (chain: Chain): Promise<FactoryConfigManifest> =>
  getFactoryConfigManifest(chain);

export const getFactoryExplorerTxUrl = (chain: Chain, txHash: string) => {
  if (chain !== "appchain" || !EXPLORER_APPCHAIN) return "";
  return `${EXPLORER_APPCHAIN.replace(/\/$/, "")}/tx/${txHash}`;
};
