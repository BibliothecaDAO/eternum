import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Chain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import type React from "react";
import { useCallback } from "react";
import { constants, shortString } from "starknet";
import { env } from "../../../../env";
import { policies } from "./policies";

const preset: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

// ==============================================

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_CHAIN_NETWORK = "Katana Local";
const KATANA_CHAIN_NAME = "katana";
const KATANA_RPC_URL = "http://localhost:5050";
const isLocal = env.VITE_PUBLIC_CHAIN === "local";

// ==============================================

// Self-hosted appchain (AWS katana) — bespoke id so the Controller keychain can
// distinguish it from public networks. RPC comes from VITE_PUBLIC_NODE_URL.
const APPCHAIN_CHAIN_ID = shortString.encodeShortString("WP_REALMS_DEV");
const APPCHAIN_CHAIN_NETWORK = "Realms Appchain";
const APPCHAIN_CHAIN_NAME = "appchain";
const APPCHAIN_RPC_URL = env.VITE_PUBLIC_NODE_URL;

const isAppchain = env.VITE_PUBLIC_CHAIN === "appchain";

// ==============================================

const chain_id = isLocal
  ? KATANA_CHAIN_ID
  : isAppchain
    ? APPCHAIN_CHAIN_ID
    : env.VITE_PUBLIC_CHAIN === "sepolia"
      ? constants.StarknetChainId.SN_SEPOLIA
      : constants.StarknetChainId.SN_MAIN;

const controller = new ControllerConnector({
  chains: [
    {
      rpcUrl: isLocal
        ? KATANA_RPC_URL
        : isAppchain
          ? APPCHAIN_RPC_URL
          : env.VITE_PUBLIC_NODE_URL !== "http://localhost:5050"
            ? env.VITE_PUBLIC_NODE_URL
            : "https://api.cartridge.gg/x/starknet/sepolia",
    },
  ],
  defaultChainId: isLocal
    ? KATANA_CHAIN_ID
    : isAppchain
      ? APPCHAIN_CHAIN_ID
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
  paymasterRpcUrls: {
    default: {
      http: [],
    },
    public: {
      http: [],
    },
  },
} as const satisfies Chain;

const appchainChain = {
  id: BigInt(APPCHAIN_CHAIN_ID),
  network: APPCHAIN_CHAIN_NETWORK,
  name: APPCHAIN_CHAIN_NAME,
  nativeCurrency: {
    address: env.VITE_PUBLIC_FEE_TOKEN_ADDRESS as `0x${string}`,
    name: "Stark",
    symbol: "STRK",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [APPCHAIN_RPC_URL],
    },
    public: {
      http: [APPCHAIN_RPC_URL],
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

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);

  let { connectors: predeployedConnectors } = usePredeployedAccounts({
    rpc: env.VITE_PUBLIC_NODE_URL as string,
    id: "katana",
    name: "Katana",
  });

  const paymasterRpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);

  return (
    <StarknetConfig
      chains={isLocal ? [katanaLocalChain] : isAppchain ? [appchainChain] : [mainnet, sepolia]}
      provider={jsonRpcProvider({ rpc })}
      paymasterProvider={isLocal ? paymasterRpcProvider({ rpc: paymasterRpc }) : undefined}
      connectors={isLocal ? predeployedConnectors : [controller as unknown as Connector]}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
