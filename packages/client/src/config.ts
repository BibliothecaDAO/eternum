import type { Account, AccountInterface } from "starknet";

export interface EternumClientConfig {
  rpcUrl: string;
  toriiUrl: string;
  worldAddress: string;
  manifest: any;
  cacheUrl?: string;
  cacheTtlMs?: number;
  vrfProviderAddress?: string;
}

export type Signer = Account | AccountInterface;
