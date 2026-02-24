import type { Chain } from "@contracts";
import { mainnet, sepolia } from "@starknet-react/chains";
import { constants, shortString } from "starknet";
import { toast } from "sonner";

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");

const SLOT_CHAIN_ID = "0x57505f455445524e554d5f424c49545a5f534c4f545f33";
const SLOT_TEST_CHAIN_ID = "0x57505f455445524e554d5f424c49545a5f534c4f545f54455354";
const SLOT_CHAIN_PREFIX = "0x57505f"; // "WP_" in ASCII hex

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

const SLOT_CHAIN_ALIASES = new Set(
  [normalizeChainId(SLOT_CHAIN_ID), normalizeChainId(SLOT_TEST_CHAIN_ID)].filter((value): value is string =>
    Boolean(value),
  ),
);

const KATANA_CHAIN_ALIAS = normalizeChainId(KATANA_CHAIN_ID);

const resolveConnectedChainFromRpcUrl = (rpcUrl: string | null | undefined): Chain | null => {
  if (!rpcUrl) return null;

  const normalized = rpcUrl.toLowerCase();

  if (normalized.includes("/starknet/mainnet")) return "mainnet";
  if (normalized.includes("/starknet/sepolia")) return "sepolia";

  if (normalized.includes("/katana")) {
    if (normalized.includes("slot-test") || normalized.includes("slottest")) return "slottest";
    if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) return "local";
    return "slot";
  }

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
  if (SLOT_CHAIN_ALIASES.has(normalized) || normalized.startsWith(SLOT_CHAIN_PREFIX)) return "slot";

  return null;
};

export const getChainLabel = (chain: Chain): string => {
  switch (chain) {
    case "mainnet":
      return "Mainnet";
    case "sepolia":
      return "Sepolia";
    case "slottest":
      return "Slot Test";
    case "local":
      return "Local";
    case "slot":
    default:
      return "Slot";
  }
};

export const getSwitchChainIdForChain = (chain: Chain): string => {
  switch (chain) {
    case "mainnet":
      return constants.StarknetChainId.SN_MAIN;
    case "sepolia":
      return constants.StarknetChainId.SN_SEPOLIA;
    case "slottest":
      return SLOT_TEST_CHAIN_ID;
    case "local":
      return KATANA_CHAIN_ID;
    case "slot":
    default:
      return SLOT_CHAIN_ID;
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
