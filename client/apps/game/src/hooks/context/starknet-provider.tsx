import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Chain, getSlotChain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { constants, shortString } from "starknet";
import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { bootstrapGame } from "../../init/bootstrap";
import { useAccountStore } from "../store/use-account-store";
import { buildPolicies } from "./policies";
import { useControllerAccount } from "./use-controller-account";

const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

// ==============================================

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_CHAIN_NETWORK = "Katana Local";
const KATANA_CHAIN_NAME = "katana";
const KATANA_RPC_URL = "http://localhost:5050";
const isLocal = env.VITE_PUBLIC_CHAIN === "local";

// ==============================================

const SLOT_CHAIN_ID = "0x57505f455445524e554d5f424c49545a5f534c4f545f33";
const SLOT_RPC_URL = "https://api.cartridge.gg/x/eternum-blitz-slot-3/katana";

const SLOT_CHAIN_ID_TEST = "0x57505f455445524e554d5f424c49545a5f534c4f545f54455354";
const SLOT_RPC_URL_TEST = "https://api.cartridge.gg/x/eternum-blitz-slot-test/katana";

const isSlot = env.VITE_PUBLIC_CHAIN === "slot";
const isSlottest = env.VITE_PUBLIC_CHAIN === "slottest";

// ==============================================

const chain_id = isLocal
  ? KATANA_CHAIN_ID
  : isSlot
    ? SLOT_CHAIN_ID
    : isSlottest
      ? SLOT_CHAIN_ID_TEST
      : env.VITE_PUBLIC_CHAIN === "sepolia"
        ? constants.StarknetChainId.SN_SEPOLIA
        : constants.StarknetChainId.SN_MAIN;

const controller = new ControllerConnector({
  chains: [
    {
      rpcUrl: isLocal
        ? KATANA_RPC_URL
        : isSlot
          ? SLOT_RPC_URL
          : isSlottest
            ? SLOT_RPC_URL_TEST
            : env.VITE_PUBLIC_NODE_URL !== "http://localhost:5050"
              ? env.VITE_PUBLIC_NODE_URL
              : "https://api.cartridge.gg/x/starknet/sepolia",
    },
  ],
  defaultChainId: isLocal
    ? KATANA_CHAIN_ID
    : isSlot
      ? SLOT_CHAIN_ID
      : isSlottest
        ? SLOT_CHAIN_ID_TEST
        : env.VITE_PUBLIC_CHAIN === "mainnet"
          ? constants.StarknetChainId.SN_MAIN
          : constants.StarknetChainId.SN_SEPOLIA,
  policies: chain_id === constants.StarknetChainId.SN_MAIN ? undefined : buildPolicies(dojoConfig.manifest),
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

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);

  const { connectors: predeployedConnectors } = usePredeployedAccounts({
    rpc: env.VITE_PUBLIC_NODE_URL as string,
    id: "katana",
    name: "Katana",
  });

  const paymasterRpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);

  return (
    <StarknetConfig
      chains={
        isLocal
          ? [katanaLocalChain]
          : isSlot
            ? [getSlotChain(SLOT_CHAIN_ID)]
            : isSlottest
              ? [getSlotChain(SLOT_CHAIN_ID_TEST)]
              : [mainnet, sepolia]
      }
      provider={jsonRpcProvider({ rpc })}
      paymasterProvider={isLocal ? paymasterRpcProvider({ rpc: paymasterRpc }) : undefined}
      connectors={isLocal ? predeployedConnectors : [controller as unknown as Connector]}
      explorer={voyager}
      autoConnect
    >
      <StarknetAccountSync>{children}</StarknetAccountSync>
    </StarknetConfig>
  );
}

const StarknetAccountSync = ({ children }: { children: React.ReactNode }) => {
  useControllerAccount();
  useBootstrapPrefetch();

  return <>{children}</>;
};

const useBootstrapPrefetch = () => {
  const account = useAccountStore((state) => state.account);
  const hasPrefetchedRef = useRef(false);

  useEffect(() => {
    // Skip bootstrap entirely on factory route so it can operate without sync
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/factory")) {
      return;
    }

    if (!account || hasPrefetchedRef.current) {
      return;
    }

    hasPrefetchedRef.current = true;

    void bootstrapGame().catch((error) => {
      console.error("[BOOTSTRAP PREFETCH FAILED]", error);
      hasPrefetchedRef.current = false;
    });
  }, [account]);
};
