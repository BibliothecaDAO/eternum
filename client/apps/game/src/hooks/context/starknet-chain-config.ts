import type { Chain } from "@contracts";

import { normalizeRpcUrl } from "@/runtime/world";
import { constants, shortString } from "starknet";

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_RPC_URL = "http://localhost:5050";
const SLOT_CHAIN_ID = "0x57505f455445524e554d5f424c49545a5f534c4f545f34";
const SLOT_CHAIN_ID_TEST = "0x57505f455445524e554d5f424c49545a5f534c4f545f54455354";

type DerivedChain = {
  kind: "slot" | "mainnet" | "sepolia";
  chainId: string;
};

interface StarknetRuntimeConfig {
  chainKind: "local" | "slot" | "mainnet" | "sepolia";
  defaultChainId: string;
  rpcUrl: string;
  controllerSupportedRpcUrls: string[];
}

const deriveChainFromRpcUrl = (value: string): DerivedChain | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    const path = url.pathname;
    const lowerPath = path.toLowerCase();

    if (lowerPath.includes("/starknet/mainnet")) {
      return { kind: "mainnet", chainId: constants.StarknetChainId.SN_MAIN };
    }

    if (lowerPath.includes("/starknet/sepolia")) {
      return { kind: "sepolia", chainId: constants.StarknetChainId.SN_SEPOLIA };
    }

    const match = path.match(/\/x\/([^/]+)\/katana/i);
    if (!match) return null;

    const slug = match[1];
    const label = `WP_${slug.replace(/-/g, "_").toUpperCase()}`;
    if (label.length > 31) return null;

    return { kind: "slot", chainId: shortString.encodeShortString(label) };
  } catch {
    return null;
  }
};

const buildCartridgeRpcUrl = (cartridgeApiBase: string, path: string) =>
  normalizeRpcUrl(`${cartridgeApiBase}${path.startsWith("/") ? path : `/${path}`}`);

const resolveSlotRuntimeChainId = (selectedChain: Chain, baseRpcUrl: string): string => {
  if (selectedChain === "slottest") {
    return SLOT_CHAIN_ID_TEST;
  }

  const derivedChain = deriveChainFromRpcUrl(baseRpcUrl);
  if (derivedChain?.kind === "slot") {
    return derivedChain.chainId;
  }

  return SLOT_CHAIN_ID;
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
  const slotRpcUrl = buildCartridgeRpcUrl(cartridgeApiBase, "/x/eternum-blitz-slot-4/katana/rpc/v0_9");

  if (effectiveChain === "local") {
    return {
      chainKind: "local",
      defaultChainId: KATANA_CHAIN_ID,
      rpcUrl: KATANA_RPC_URL,
      controllerSupportedRpcUrls: [KATANA_RPC_URL, slotRpcUrl, sepoliaRpcUrl, mainnetRpcUrl],
    };
  }

  if (effectiveChain === "mainnet") {
    return {
      chainKind: "mainnet",
      defaultChainId: constants.StarknetChainId.SN_MAIN,
      rpcUrl: mainnetRpcUrl,
      controllerSupportedRpcUrls: [mainnetRpcUrl, slotRpcUrl, sepoliaRpcUrl],
    };
  }

  if (effectiveChain === "sepolia") {
    return {
      chainKind: "sepolia",
      defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
      rpcUrl: sepoliaRpcUrl,
      controllerSupportedRpcUrls: [sepoliaRpcUrl, slotRpcUrl, mainnetRpcUrl],
    };
  }

  return {
    chainKind: "slot",
    defaultChainId: resolveSlotRuntimeChainId(effectiveChain, normalizedBaseRpcUrl),
    rpcUrl: normalizedBaseRpcUrl,
    controllerSupportedRpcUrls: Array.from(new Set([normalizedBaseRpcUrl, slotRpcUrl, sepoliaRpcUrl, mainnetRpcUrl])),
  };
};
