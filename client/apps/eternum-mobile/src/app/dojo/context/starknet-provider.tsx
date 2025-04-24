import { getResourceAddresses } from "@/shared/lib/addresses";
import { ControllerConnector } from "@cartridge/connector";
import { Chain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, voyager } from "@starknet-react/core";
import type React from "react";
import { useCallback } from "react";
import { constants, shortString } from "starknet";
import { env } from "../../../../env";
import { policies } from "./policies";

const resourceAddresses = getResourceAddresses();

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_CHAIN_NETWORK = "Katana Local";
const KATANA_CHAIN_NAME = "katana";
const KATANA_RPC_URL = "http://localhost:5050";

const LORDS = resourceAddresses["LORDS"][1].toString();
const otherResources = Object.entries(resourceAddresses)
  .filter(([key]) => key !== "LORDS")
  .map(([_, [__, address]]) => address)
  .toString();

const preset: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

const isLocal = env.VITE_PUBLIC_CHAIN === "local";

const nonLocalController = new ControllerConnector({
  chains: [
    {
      rpcUrl: isLocal
        ? KATANA_RPC_URL
        : env.VITE_PUBLIC_NODE_URL !== "http://localhost:5050"
          ? env.VITE_PUBLIC_NODE_URL
          : "https://api.cartridge.gg/x/starknet/sepolia",
    },
  ],
  defaultChainId: isLocal
    ? KATANA_CHAIN_ID
    : env.VITE_PUBLIC_CHAIN === "mainnet"
      ? constants.StarknetChainId.SN_MAIN
      : constants.StarknetChainId.SN_SEPOLIA,
  preset,
  policies,
  slot,
  namespace,
  tokens: {
    erc20: [LORDS, ...otherResources],
  },
});

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
} as const satisfies Chain;

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);

  return (
    <StarknetConfig
      chains={isLocal ? [katanaLocalChain] : [mainnet, sepolia]}
      provider={jsonRpcProvider({ rpc })}
      connectors={[nonLocalController as unknown as Connector]}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
