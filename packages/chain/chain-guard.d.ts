export const CHAIN_NAMES: Readonly<{
  mainnet: "SN_MAIN";
  appchain: "WP_REALMS_DEV";
  madara: "WP_REALMS_MADARA_LAB";
}>;

export const GAME_CHAIN_NAMES: Readonly<{
  appchain: "WP_REALMS_DEV";
  madara: "WP_REALMS_MADARA_LAB";
}>;

export type ChainTarget = keyof typeof CHAIN_NAMES;

export interface ChainIdProvider {
  getChainId(): Promise<string>;
}

export function encodeChainName(chainName: string): string;
export function expectedChainId(target: ChainTarget): string;
export function assertChainId(
  actualChainId: string,
  target: ChainTarget,
  environmentName: string,
): void;
export function assertProviderChain(
  provider: ChainIdProvider,
  target: ChainTarget,
  environmentName: string,
): Promise<string>;
