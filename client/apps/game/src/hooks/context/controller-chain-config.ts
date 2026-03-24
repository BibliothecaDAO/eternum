import { normalizeRpcUrl } from "@/runtime/world/normalize";
import { constants, shortString } from "starknet";

const SLOT_CHAIN_ID = "0x57505f455445524e554d5f424c49545a5f534c4f545f34";
const SLOT_CHAIN_ID_TEST = "0x57505f455445524e554d5f424c49545a5f534c4f545f54455354";
const DEFAULT_CARTRIDGE_API_BASE = "https://api.cartridge.gg";

export type ControllerChainKind = "slot" | "mainnet" | "sepolia";

export type DerivedControllerChain = {
  kind: ControllerChainKind;
  chainId: string;
};

type ResolveControllerChainInput = {
  configuredChain: string;
  rpcUrl: string;
};

type BuildControllerRpcUrlListInput = {
  primaryRpcUrl: string;
  cartridgeApiBase?: string;
  existingRpcUrls?: string[];
};

type ResolveControllerNetworkConfigInput = ResolveControllerChainInput & {
  cartridgeApiBase?: string;
  existingRpcUrls?: string[];
};

export type ControllerNetworkConfig = {
  normalizedRpcUrl: string;
  resolvedChain: DerivedControllerChain;
  supportedRpcUrls: string[];
};

const toUniqueNormalizedRpcUrls = (values: string[]): string[] => {
  const normalized = values
    .map((value) => normalizeRpcUrl(value))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(normalized));
};

const getFallbackControllerChain = (configuredChain: string): DerivedControllerChain => {
  if (configuredChain === "slot") {
    return { kind: "slot", chainId: SLOT_CHAIN_ID };
  }

  if (configuredChain === "slottest") {
    return { kind: "slot", chainId: SLOT_CHAIN_ID_TEST };
  }

  if (configuredChain === "mainnet") {
    return { kind: "mainnet", chainId: constants.StarknetChainId.SN_MAIN };
  }

  return { kind: "sepolia", chainId: constants.StarknetChainId.SN_SEPOLIA };
};

const getControllerRpcDefaults = (cartridgeApiBase: string): string[] => [
  `${cartridgeApiBase}/x/eternum-blitz-slot-4/katana/rpc/v0_9`,
  `${cartridgeApiBase}/x/starknet/sepolia/rpc/v0_9`,
  `${cartridgeApiBase}/x/starknet/mainnet/rpc/v0_9`,
];

export const deriveControllerChainFromRpcUrl = (value: string): DerivedControllerChain | null => {
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

export const resolveControllerChain = (input: ResolveControllerChainInput): DerivedControllerChain => {
  const normalizedRpcUrl = normalizeRpcUrl(input.rpcUrl);
  return deriveControllerChainFromRpcUrl(normalizedRpcUrl) ?? getFallbackControllerChain(input.configuredChain);
};

export const buildControllerRpcUrlList = (input: BuildControllerRpcUrlListInput): string[] => {
  const cartridgeApiBase = input.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE;
  return toUniqueNormalizedRpcUrls([
    input.primaryRpcUrl,
    ...(input.existingRpcUrls ?? []),
    ...getControllerRpcDefaults(cartridgeApiBase),
  ]);
};

export const resolveControllerNetworkConfig = (input: ResolveControllerNetworkConfigInput): ControllerNetworkConfig => {
  const normalizedRpcUrl = normalizeRpcUrl(input.rpcUrl);
  const resolvedChain = resolveControllerChain({
    configuredChain: input.configuredChain,
    rpcUrl: normalizedRpcUrl,
  });

  return {
    normalizedRpcUrl,
    resolvedChain,
    supportedRpcUrls: buildControllerRpcUrlList({
      primaryRpcUrl: normalizedRpcUrl,
      cartridgeApiBase: input.cartridgeApiBase,
      existingRpcUrls: input.existingRpcUrls,
    }),
  };
};

export const areSameRpcUrlSets = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);
  return right.every((value) => leftSet.has(value));
};
