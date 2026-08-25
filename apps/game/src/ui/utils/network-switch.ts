import type { Chain } from "@contracts";
import { mainnet, sepolia } from "@starknet-react/chains";
import { toast } from "sonner";
import { constants, shortString } from "starknet";

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");

// The self-hosted appchain uses a bespoke WP_ id so the keychain can tell it
// apart from the public networks.
const APPCHAIN_CHAIN_ID = shortString.encodeShortString("WP_REALMS_DEV");

export interface WalletChainControllerLike {
  switchStarknetChain?: (chainId: string) => Promise<boolean>;
  openSettings?: () => void;
  rpcUrl?: () => string;
}

const normalizeChainId = (value: bigint | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;

  try {
    if (typeof value === "bigint") {
      return `0x${value.toString(16)}`;
    }

    if (value.startsWith("0x")) {
      return `0x${BigInt(value).toString(16)}`;
    }

    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return String(value).toLowerCase();
  }
};

const MAINNET_CHAIN_ALIASES = new Set(
  [normalizeChainId(mainnet.id), normalizeChainId(constants.StarknetChainId.SN_MAIN), "sn_main", "mainnet"].filter(
    (value): value is string => Boolean(value),
  ),
);

const SEPOLIA_CHAIN_ALIASES = new Set(
  [
    normalizeChainId(sepolia.id),
    normalizeChainId(constants.StarknetChainId.SN_SEPOLIA),
    "sn_sepolia",
    "sepolia",
  ].filter((value): value is string => Boolean(value)),
);

const KATANA_CHAIN_ALIAS = normalizeChainId(KATANA_CHAIN_ID);
const APPCHAIN_CHAIN_ALIAS = normalizeChainId(APPCHAIN_CHAIN_ID);

const resolveConnectedChainFromRpcUrl = (rpcUrl: string | null | undefined): Chain | null => {
  if (!rpcUrl) return null;

  const normalized = rpcUrl.toLowerCase();

  if (normalized.includes("/starknet/mainnet")) return "mainnet";
  if (normalized.includes("/starknet/sepolia")) return "sepolia";

  if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) return "local";

  return null;
};

export const resolveConnectedTxChainFromRuntime = ({
  chainId,
  controller,
}: {
  chainId: bigint | string | null | undefined;
  controller?: WalletChainControllerLike | null;
}): Chain | null => {
  const fromControllerRpc = resolveConnectedChainFromRpcUrl(controller?.rpcUrl?.());
  if (fromControllerRpc) return fromControllerRpc;

  const normalized = normalizeChainId(chainId);
  if (!normalized) return null;

  if (MAINNET_CHAIN_ALIASES.has(normalized)) return "mainnet";
  if (SEPOLIA_CHAIN_ALIASES.has(normalized)) return "sepolia";
  if (KATANA_CHAIN_ALIAS && normalized === KATANA_CHAIN_ALIAS) return "local";
  if (APPCHAIN_CHAIN_ALIAS && normalized === APPCHAIN_CHAIN_ALIAS) return "appchain";

  return null;
};

export const getChainLabel = (chain: Chain): string => {
  switch (chain) {
    case "mainnet":
      return "Mainnet";
    case "sepolia":
      return "Sepolia";
    case "local":
      return "Local";
    case "appchain":
    default:
      return "Appchain";
  }
};

const getSwitchChainIdForChain = (chain: Chain): string => {
  switch (chain) {
    case "mainnet":
      return constants.StarknetChainId.SN_MAIN;
    case "sepolia":
      return constants.StarknetChainId.SN_SEPOLIA;
    case "local":
      return KATANA_CHAIN_ID;
    case "appchain":
    default:
      return APPCHAIN_CHAIN_ID;
  }
};

export const switchWalletToChain = async ({
  controller,
  targetChain,
}: {
  controller?: WalletChainControllerLike | null;
  targetChain: Chain;
}): Promise<boolean> => {
  const targetLabel = getChainLabel(targetChain);

  if (!controller?.switchStarknetChain) {
    toast.error(`Please switch to ${targetLabel} in your wallet, then retry.`);
    controller?.openSettings?.();
    return false;
  }

  try {
    const switched = await controller.switchStarknetChain(getSwitchChainIdForChain(targetChain));
    if (!switched) {
      toast.error(`Could not switch to ${targetLabel}. Please switch manually in your wallet.`);
      controller.openSettings?.();
      return false;
    }

    toast.success(`Switched to ${targetLabel}.`);
    return true;
  } catch (error) {
    console.error("Failed to switch network:", error);
    toast.error(`Could not switch to ${targetLabel}. Please switch manually in your wallet.`);
    controller.openSettings?.();
    return false;
  }
};
