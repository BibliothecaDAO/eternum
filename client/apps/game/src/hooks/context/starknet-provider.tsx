import { normalizeRpcUrl } from "@/runtime/world";
import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Chain, getSlotChain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import { QueryClient } from "@tanstack/react-query";
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

const SLOT_CHAIN_ID_TEST = "0x57505f455445524e554d5f424c49545a5f534c4f545f54455354";

const isSlot = env.VITE_PUBLIC_CHAIN === "slot";
const isSlottest = env.VITE_PUBLIC_CHAIN === "slottest";

// ==============================================

const baseRpcUrl = isLocal ? KATANA_RPC_URL : dojoConfig.rpcUrl || env.VITE_PUBLIC_NODE_URL;
const rpcUrl = normalizeRpcUrl(baseRpcUrl);

console.log("baseRpcUrl", baseRpcUrl);

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
  propagateSessionErrors: true,
  // chain_id,
  chains: [
    {
      rpcUrl,
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
  policies: buildPolicies(dojoConfig.manifest),
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

// Custom QueryClient with game-appropriate defaults
// - Disable refetchOnWindowFocus to prevent surprise refetch storms when alt-tabbing
// - Disable refetchOnReconnect for similar reasons in a real-time game
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5000, // 5 seconds default stale time
    },
  },
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const rpc = useCallback(() => {
    return { nodeUrl: rpcUrl };
  }, []);

  const { connectors: predeployedConnectors } = usePredeployedAccounts({
    rpc: rpcUrl,
    id: "katana",
    name: "Katana",
  });

  const paymasterRpc = useCallback(() => {
    return { nodeUrl: rpcUrl };
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
              : env.VITE_PUBLIC_CHAIN === "mainnet"
                ? [mainnet]
                : [sepolia]
      }
      provider={jsonRpcProvider({ rpc })}
      paymasterProvider={isLocal ? paymasterRpcProvider({ rpc: paymasterRpc }) : undefined}
      connectors={isLocal ? predeployedConnectors : [controller as unknown as Connector]}
      explorer={voyager}
      autoConnect
      queryClient={queryClient}
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
