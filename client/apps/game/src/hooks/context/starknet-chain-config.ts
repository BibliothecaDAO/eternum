import type { Chain } from "@contracts";

import { isRpcUrlCompatibleForChain, normalizeRpcUrl } from "@/runtime/world/normalize";
import { constants, shortString } from "starknet";

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_RPC_URL = "http://localhost:5050";
// Self-hosted appchain (AWS) — bespoke id so the Controller keychain can
// distinguish it from public networks. RPC comes from VITE_PUBLIC_NODE_URL.
export const APPCHAIN_CHAIN_ID = shortString.encodeShortString("WP_REALMS_DEV");

interface StarknetRuntimeConfig {
  chainKind: "local" | "mainnet" | "sepolia" | "appchain";
  defaultChainId: string;
  rpcUrl: string;
  controllerSupportedRpcUrls: string[];
}

const buildCartridgeRpcUrl = (cartridgeApiBase: string, path: string) =>
  normalizeRpcUrl(`${cartridgeApiBase}${path.startsWith("/") ? path : `/${path}`}`);

const buildSupportedRpcUrls = (preferredRpcUrl: string, ...additionalRpcUrls: string[]): string[] => {
  return Array.from(new Set([preferredRpcUrl, ...additionalRpcUrls]));
};

const resolveChainCompatibleRuntimeRpcUrl = ({
  chain,
  fallbackRpcUrl,
  requestedRpcUrl,
}: {
  chain: Chain;
  fallbackRpcUrl: string;
  requestedRpcUrl: string;
}): string => {
  return isRpcUrlCompatibleForChain(chain, requestedRpcUrl) ? requestedRpcUrl : fallbackRpcUrl;
};

export const resolveStarknetRuntimeConfig = ({
  fallbackChain,
  selectedChain,
  baseRpcUrl,
  cartridgeApiBase,
}: {
  fallbackChain: Chain;
  selectedChain: Chain | null;
  baseRpcUrl: string;
  cartridgeApiBase: string;
}): StarknetRuntimeConfig => {
  const normalizedBaseRpcUrl = normalizeRpcUrl(baseRpcUrl);
  const effectiveChain = selectedChain ?? fallbackChain;
  const mainnetRpcUrl = buildCartridgeRpcUrl(cartridgeApiBase, "/x/starknet/mainnet/rpc/v0_9");
  const sepoliaRpcUrl = buildCartridgeRpcUrl(cartridgeApiBase, "/x/starknet/sepolia/rpc/v0_9");

  if (effectiveChain === "local") {
    return {
      chainKind: "local",
      defaultChainId: KATANA_CHAIN_ID,
      rpcUrl: KATANA_RPC_URL,
      controllerSupportedRpcUrls: [KATANA_RPC_URL, sepoliaRpcUrl, mainnetRpcUrl],
    };
  }

  if (effectiveChain === "appchain") {
    return {
      chainKind: "appchain",
      defaultChainId: APPCHAIN_CHAIN_ID,
      rpcUrl: normalizedBaseRpcUrl,
      // the keychain only needs to recognize our chain; no cartridge-hosted
      // fallbacks apply to a self-hosted katana
      controllerSupportedRpcUrls: [normalizedBaseRpcUrl],
    };
  }

  if (effectiveChain === "mainnet") {
    const runtimeRpcUrl = resolveChainCompatibleRuntimeRpcUrl({
      chain: effectiveChain,
      fallbackRpcUrl: mainnetRpcUrl,
      requestedRpcUrl: normalizedBaseRpcUrl,
    });

    return {
      chainKind: "mainnet",
      defaultChainId: constants.StarknetChainId.SN_MAIN,
      rpcUrl: runtimeRpcUrl,
      controllerSupportedRpcUrls: buildSupportedRpcUrls(runtimeRpcUrl, sepoliaRpcUrl, mainnetRpcUrl),
    };
  }

  const runtimeRpcUrl = resolveChainCompatibleRuntimeRpcUrl({
    chain: "sepolia",
    fallbackRpcUrl: sepoliaRpcUrl,
    requestedRpcUrl: normalizedBaseRpcUrl,
  });

  return {
    chainKind: "sepolia",
    defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
    rpcUrl: runtimeRpcUrl,
    controllerSupportedRpcUrls: buildSupportedRpcUrls(runtimeRpcUrl, mainnetRpcUrl, sepoliaRpcUrl),
  };
};
