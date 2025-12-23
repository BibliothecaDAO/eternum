import { buildStarknetConfig, type StarknetChainKey } from "@bibliothecadao/react";
import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { bootstrapGame } from "../../init/bootstrap";
import { useAccountStore } from "../store/use-account-store";
import { buildPolicies } from "./policies";
import { useControllerAccount } from "./use-controller-account";

const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

const { isLocal, chains, controllerOptions } = buildStarknetConfig({
  chain: env.VITE_PUBLIC_CHAIN as StarknetChainKey,
  nodeUrl: env.VITE_PUBLIC_NODE_URL,
  slot,
  namespace,
  policies: buildPolicies(dojoConfig.manifest),
  applyPoliciesOnMainnet: true,
  includeAllPublicChains: false,
});

const controller = new ControllerConnector(controllerOptions);

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
      chains={chains}
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
