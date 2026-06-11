import { RpcProvider } from "starknet";

const providerCache = new Map<string, RpcProvider>();

/**
 * Shared RpcProvider per node URL. Every fresh RpcProvider pays a
 * starknet_specVersion/chainId handshake on its first request, so ad-hoc
 * `new RpcProvider(...)` at call sites multiplies boot/entry RPC calls.
 */
export const getCachedRpcProvider = (nodeUrl: string): RpcProvider => {
  const existing = providerCache.get(nodeUrl);
  if (existing) return existing;
  const provider = new RpcProvider({ nodeUrl });
  providerCache.set(nodeUrl, provider);
  return provider;
};
