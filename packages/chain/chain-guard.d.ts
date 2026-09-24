export const CHAIN_NAMES: Readonly<{
  mainnet: "SN_MAIN";
  sepolia: "SN_SEPOLIA";
}>;

export interface ShardIdentity {
  shard: { chainId: string };
}
export type ChainTarget = keyof typeof CHAIN_NAMES | ShardIdentity;
export function shardChainId(manifest: unknown): string;

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
export function assertExpectedChainId(
  actualChainId: string,
  expectedChainId: string,
  environmentName: string,
  expectedLabel: string,
): void;
export function assertProviderChain(
  provider: ChainIdProvider,
  target: ChainTarget,
  environmentName: string,
): Promise<string>;
