import { ControllerConnector } from "@cartridge/connector";
import { Chain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, voyager } from "@starknet-react/core";
import type React from "react";
import { useCallback } from "react";
import { constants, shortString } from "starknet";
import { env } from "../../../env";

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_CHAIN_NETWORK = "Katana Local";
const KATANA_CHAIN_NAME = "katana";
const KATANA_RPC_URL = "http://localhost:5050";

const preset: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

const isLocal = env.VITE_PUBLIC_CHAIN === "local";

const chain_id = isLocal
  ? KATANA_CHAIN_ID
  : env.VITE_PUBLIC_CHAIN === "sepolia"
    ? constants.StarknetChainId.SN_SEPOLIA
    : constants.StarknetChainId.SN_MAIN;

const controller = new ControllerConnector({
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
  policies: chain_id === constants.StarknetChainId.SN_MAIN ? undefined : policies,
  slot,
  namespace,
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
      connectors={[controller as unknown as Connector]}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
