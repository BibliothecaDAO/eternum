import type { Manifest } from "@bibliothecadao/types";
import type { Account, AccountInterface } from "starknet";

export interface ClientLogger {
  warn(message: string, details?: unknown): void;
}

export interface EternumClientConfig {
  chain: "madara" | "appchain";
  gameId: number;
  heraldUrl: string;
  rpcUrl: string;
  worldAddress: string;
  manifest: Manifest;
  cacheTtlMs?: number;
  cacheMaxSize?: number;
  vrfProviderAddress?: string;
  logger?: ClientLogger;
}

export type Signer = Account | AccountInterface;
