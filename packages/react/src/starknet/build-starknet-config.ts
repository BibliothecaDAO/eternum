import { getSlotChain, mainnet, sepolia, type Chain } from "@starknet-react/chains";
import { constants, shortString } from "starknet";

export type StarknetChainKey = "local" | "slot" | "slottest" | "sepolia" | "mainnet";

export interface StarknetConfigOptions {
  chain: StarknetChainKey;
  nodeUrl: string;
  slot: string;
  namespace: string;
  preset?: string;
  policies?: unknown;
  applyPoliciesOnMainnet?: boolean;
  includeAllPublicChains?: boolean;
  fallbackNodeUrl?: string;
}

export interface ControllerConnectorOptions {
  chains: { rpcUrl: string }[];
  defaultChainId: string;
  slot: string;
  namespace: string;
  preset?: string;
  policies?: unknown;
}

export interface BuiltStarknetConfig {
  isLocal: boolean;
  isSlot: boolean;
  isSlottest: boolean;
  chainId: string;
  chains: Chain[];
  controllerOptions: ControllerConnectorOptions;
}

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_CHAIN_NETWORK = "Katana Local";
const KATANA_CHAIN_NAME = "katana";
const KATANA_RPC_URL = "http://localhost:5050";

const SLOT_CHAIN_ID = "0x57505f455445524e554d5f424c49545a5f534c4f545f33";
const SLOT_RPC_URL = "https://api.cartridge.gg/x/eternum-blitz-slot-3/katana";

const SLOT_CHAIN_ID_TEST = "0x57505f455445524e554d5f424c49545a5f534c4f545f54455354";
const SLOT_RPC_URL_TEST = "https://api.cartridge.gg/x/eternum-blitz-slot-test/katana";

const katanaLocalChain = {
  id: BigInt(KATANA_CHAIN_ID),
  network: KATANA_CHAIN_NETWORK,
  name: KATANA_CHAIN_NAME,
  nativeCurrency: {
    address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [KATANA_RPC_URL],
    },
    public: {
      http: [KATANA_RPC_URL],
    },
  },
  paymasterRpcUrls: {
    default: {
      http: [],
    },
    public: {
      http: [],
    },
  },
} as const satisfies Chain;

const resolvePublicRpcUrl = (nodeUrl: string, fallbackNodeUrl?: string) => {
  if (fallbackNodeUrl && (!nodeUrl || nodeUrl === KATANA_RPC_URL)) {
    return fallbackNodeUrl;
  }

  return nodeUrl;
};

export const buildStarknetConfig = ({
  chain,
  nodeUrl,
  slot,
  namespace,
  preset,
  policies,
  applyPoliciesOnMainnet = true,
  includeAllPublicChains = false,
  fallbackNodeUrl,
}: StarknetConfigOptions): BuiltStarknetConfig => {
  const isLocal = chain === "local";
  const isSlot = chain === "slot";
  const isSlottest = chain === "slottest";

  const chainId = isLocal
    ? KATANA_CHAIN_ID
    : isSlot
      ? SLOT_CHAIN_ID
      : isSlottest
        ? SLOT_CHAIN_ID_TEST
        : chain === "sepolia"
          ? constants.StarknetChainId.SN_SEPOLIA
          : constants.StarknetChainId.SN_MAIN;

  const controllerRpcUrl = isLocal
    ? KATANA_RPC_URL
    : isSlot
      ? SLOT_RPC_URL
      : isSlottest
        ? SLOT_RPC_URL_TEST
        : resolvePublicRpcUrl(nodeUrl, fallbackNodeUrl);

  const resolvedPolicies =
    policies && (applyPoliciesOnMainnet || chainId !== constants.StarknetChainId.SN_MAIN) ? policies : undefined;

  const controllerOptions: ControllerConnectorOptions = {
    chains: [{ rpcUrl: controllerRpcUrl }],
    defaultChainId: chainId,
    slot,
    namespace,
  };

  if (preset) {
    controllerOptions.preset = preset;
  }

  if (resolvedPolicies) {
    controllerOptions.policies = resolvedPolicies;
  }

  const publicChains = includeAllPublicChains ? [mainnet, sepolia] : chain === "mainnet" ? [mainnet] : [sepolia];
  const chains = isLocal
    ? [katanaLocalChain]
    : isSlot
      ? [getSlotChain(SLOT_CHAIN_ID)]
      : isSlottest
        ? [getSlotChain(SLOT_CHAIN_ID_TEST)]
        : publicChains;

  return {
    isLocal,
    isSlot,
    isSlottest,
    chainId,
    chains,
    controllerOptions,
  };
};
