import { createShardRpcProvider } from "@bibliothecadao/provider";
import type { RpcProvider } from "starknet";

const providerCache = new Map<string, RpcProvider>();

/**
 * Shared RpcProvider per shard RPC URL. Every fresh RpcProvider pays a
 * starknet_specVersion/chainId handshake on its first request, so ad-hoc
 * providers at call sites multiply boot/entry RPC calls.
 */
export const getShardRpcProvider = (nodeUrl: string): RpcProvider => {
  const existing = providerCache.get(nodeUrl);
  if (existing) return existing;
  const provider = createShardRpcProvider(nodeUrl);
  providerCache.set(nodeUrl, provider);
  return provider;
};
