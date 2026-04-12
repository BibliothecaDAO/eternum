import { useSelectedRuntimeChain } from "@/runtime/world";
import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Chain, getSlotChain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useMemo } from "react";
import { shortString } from "starknet";
import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { resolveStarknetRuntimeConfig } from "./starknet-chain-config";
import { useControllerAccount } from "./use-controller-account";

const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

// ==============================================

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_CHAIN_NETWORK = "Katana Local";
const KATANA_CHAIN_NAME = "katana";
const KATANA_RPC_URL = "http://localhost:5050";
const isLocal = env.VITE_PUBLIC_CHAIN === "local";

const fallbackChain = env.VITE_PUBLIC_CHAIN as import("@contracts").Chain;
const baseRpcUrl = isLocal ? KATANA_RPC_URL : dojoConfig.rpcUrl || env.VITE_PUBLIC_NODE_URL;
const cartridgeApiBase = env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg";

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
  const selectedChain = useSelectedRuntimeChain(fallbackChain);
  const runtimeConfig = useMemo(
    () =>
      resolveStarknetRuntimeConfig({
        fallbackChain,
        selectedChain,
        baseRpcUrl,
        cartridgeApiBase,
      }),
    [selectedChain],
  );

  const controller = useMemo(
    () =>
      new ControllerConnector({
        errorDisplayMode: "notification",
        propagateSessionErrors: true,
        chains: runtimeConfig.controllerSupportedRpcUrls.map((chainRpcUrl) => ({
          rpcUrl: chainRpcUrl,
        })),
        defaultChainId: runtimeConfig.defaultChainId,
        // Policies are intentionally omitted here so that login/connect does NOT
        // create a session upfront. Session policies are set later by
        // refreshSessionPolicies() after the player selects a game and
        // bootstrapGame() patches the manifest with the correct contract addresses.
        slot,
        namespace,
      }),
    [runtimeConfig.controllerSupportedRpcUrls, runtimeConfig.defaultChainId],
  );

  const rpc = useCallback(() => {
    return { nodeUrl: runtimeConfig.rpcUrl };
  }, [runtimeConfig.rpcUrl]);

  const { connectors: predeployedConnectors } = usePredeployedAccounts({
    rpc: runtimeConfig.rpcUrl,
    id: "katana",
    name: "Katana",
  });

  const paymasterRpc = useCallback(() => {
    return { nodeUrl: runtimeConfig.rpcUrl };
  }, [runtimeConfig.rpcUrl]);

  const resolvedChains = useMemo(() => {
    if (runtimeConfig.chainKind === "local") {
      return [katanaLocalChain];
    }

    if (runtimeConfig.chainKind === "slot") {
      return [getSlotChain(runtimeConfig.defaultChainId)];
    }

    if (runtimeConfig.chainKind === "mainnet") {
      return [mainnet];
    }

    return [sepolia];
  }, [runtimeConfig.chainKind, runtimeConfig.defaultChainId]);

  return (
    <StarknetConfig
      key={`${runtimeConfig.chainKind}:${runtimeConfig.defaultChainId}:${runtimeConfig.rpcUrl}`}
      chains={resolvedChains}
      provider={jsonRpcProvider({ rpc })}
      paymasterProvider={runtimeConfig.chainKind === "local" ? paymasterRpcProvider({ rpc: paymasterRpc }) : undefined}
      connectors={runtimeConfig.chainKind === "local" ? predeployedConnectors : [controller as unknown as Connector]}
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

  return <>{children}</>;
};
