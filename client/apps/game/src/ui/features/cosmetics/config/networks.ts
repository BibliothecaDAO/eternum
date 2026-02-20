import { getSeasonAddresses } from "@contracts";
import { mainnet, sepolia } from "@starknet-react/chains";
import { constants } from "starknet";
import { env } from "../../../../../env";

export type CosmeticsNetwork = "mainnet" | "sepolia";

const DEFAULT_MARKETPLACE_URLS: Record<CosmeticsNetwork, string> = {
  mainnet: "https://api.cartridge.gg/x/eternum-marketplace-mainnet19/torii",
  sepolia: "https://api.cartridge.gg/x/eternum-marketplace-sepolia-1/torii",
};

const MARKETPLACE_URLS: Record<CosmeticsNetwork, string> = {
  mainnet:
    (import.meta.env.VITE_PUBLIC_MAINNET_MARKETPLACE_URL as string | undefined) ??
    (env.VITE_PUBLIC_CHAIN === "mainnet" ? env.VITE_PUBLIC_MARKETPLACE_URL : DEFAULT_MARKETPLACE_URLS.mainnet),
  sepolia:
    (import.meta.env.VITE_PUBLIC_SEPOLIA_MARKETPLACE_URL as string | undefined) ??
    (env.VITE_PUBLIC_CHAIN === "sepolia" ? env.VITE_PUBLIC_MARKETPLACE_URL : DEFAULT_MARKETPLACE_URLS.sepolia),
};

const MAINNET_ADDRESSES = getSeasonAddresses("mainnet");
const SEPOLIA_ADDRESSES = getSeasonAddresses("sepolia");

export const COSMETICS_NETWORK_CONFIG: Record<
  CosmeticsNetwork,
  {
    label: string;
    marketplaceUrl: string;
    cosmeticsAddress: string;
    lootChestsAddress: string;
    cosmeticsClaimAddress: string;
    cosmeticsCollectionId: number;
    lootChestCollectionId: number;
  }
> = {
  mainnet: {
    label: "Mainnet",
    marketplaceUrl: MARKETPLACE_URLS.mainnet,
    cosmeticsAddress: MAINNET_ADDRESSES["Collectibles: Realms: Cosmetic Items"],
    lootChestsAddress: MAINNET_ADDRESSES["Collectibles: Realms: Loot Chest"],
    cosmeticsClaimAddress: MAINNET_ADDRESSES.cosmeticsClaim,
    cosmeticsCollectionId: 4,
    lootChestCollectionId: 3,
  },
  sepolia: {
    label: "Sepolia",
    marketplaceUrl: MARKETPLACE_URLS.sepolia,
    cosmeticsAddress: SEPOLIA_ADDRESSES["Collectibles: Realms: Cosmetic Items"],
    lootChestsAddress: SEPOLIA_ADDRESSES["Collectibles: Realms: Loot Chest"],
    cosmeticsClaimAddress: SEPOLIA_ADDRESSES.cosmeticsClaim,
    cosmeticsCollectionId: 6,
    lootChestCollectionId: 5,
  },
};

export const COSMETICS_NETWORKS: CosmeticsNetwork[] = ["mainnet", "sepolia"];

const normalizeChainId = (value: bigint | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;

  try {
    if (typeof value === "bigint") {
      return `0x${value.toString(16)}`;
    }

    if (value.startsWith("0x")) {
      return `0x${BigInt(value).toString(16)}`;
    }

    // Non-hex values like "SN_MAIN" are not expected from useAccount().chainId,
    // but we still normalize if we ever receive them.
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return String(value).toLowerCase();
  }
};

const MAINNET_CHAIN_ID = normalizeChainId(mainnet.id);
const SEPOLIA_CHAIN_ID = normalizeChainId(sepolia.id);
const MAINNET_CHAIN_ID_ALIAS = normalizeChainId(constants.StarknetChainId.SN_MAIN);
const SEPOLIA_CHAIN_ID_ALIAS = normalizeChainId(constants.StarknetChainId.SN_SEPOLIA);

const MAINNET_CHAIN_ALIASES = new Set(
  [MAINNET_CHAIN_ID, MAINNET_CHAIN_ID_ALIAS, "sn_main", "mainnet"].filter((value): value is string => Boolean(value)),
);
const SEPOLIA_CHAIN_ALIASES = new Set(
  [SEPOLIA_CHAIN_ID, SEPOLIA_CHAIN_ID_ALIAS, "sn_sepolia", "sepolia"].filter(
    (value): value is string => Boolean(value),
  ),
);

export const resolveConnectedTxNetwork = (chainId: bigint | string | null | undefined): CosmeticsNetwork | null => {
  const normalized = normalizeChainId(chainId);
  if (!normalized) return null;

  if (MAINNET_CHAIN_ALIASES.has(normalized)) return "mainnet";
  if (SEPOLIA_CHAIN_ALIASES.has(normalized)) return "sepolia";
  return null;
};

export const resolveConnectedTxNetworkFromRpcUrl = (rpcUrl: string | null | undefined): CosmeticsNetwork | null => {
  if (!rpcUrl) return null;

  try {
    const pathname = new URL(rpcUrl).pathname.toLowerCase();
    if (pathname.includes("/starknet/mainnet")) return "mainnet";
    if (pathname.includes("/starknet/sepolia")) return "sepolia";
  } catch {
    const normalized = rpcUrl.toLowerCase();
    if (normalized.includes("/starknet/mainnet")) return "mainnet";
    if (normalized.includes("/starknet/sepolia")) return "sepolia";
  }

  return null;
};

interface RuntimeControllerLike {
  rpcUrl?: () => string;
}

export const resolveConnectedTxNetworkFromRuntime = ({
  chainId,
  controller,
}: {
  chainId: bigint | string | null | undefined;
  controller?: RuntimeControllerLike | null;
}): CosmeticsNetwork | null => {
  const fromControllerRpc = resolveConnectedTxNetworkFromRpcUrl(controller?.rpcUrl?.());
  return fromControllerRpc ?? resolveConnectedTxNetwork(chainId);
};

export const getStarknetChainIdForNetwork = (network: CosmeticsNetwork): string =>
  network === "mainnet" ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA;

export const resolveCurrentTxNetwork = (): CosmeticsNetwork | null => {
  const chain = env.VITE_PUBLIC_CHAIN;
  if (chain === "mainnet" || chain === "sepolia") {
    return chain;
  }
  return null;
};

export const DEFAULT_COSMETICS_NETWORK: CosmeticsNetwork = resolveCurrentTxNetwork() ?? "sepolia";
