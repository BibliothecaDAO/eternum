import { getActiveWorld } from "@/runtime/world";
import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Chain, getSlotChain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { shortString } from "starknet";
import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { bootstrapGame } from "../../init/bootstrap";
import { useAccountStore } from "../store/use-account-store";
import { resolveControllerNetworkConfig } from "./controller-chain-config";
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

const baseRpcUrl = isLocal ? KATANA_RPC_URL : dojoConfig.rpcUrl || env.VITE_PUBLIC_NODE_URL;
const cartridgeApiBase = env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg";
const controllerNetworkConfig = resolveControllerNetworkConfig({
  configuredChain: env.VITE_PUBLIC_CHAIN,
  rpcUrl: baseRpcUrl,
  cartridgeApiBase,
});
const rpcUrl = controllerNetworkConfig.normalizedRpcUrl;
const resolvedChainId = isLocal ? KATANA_CHAIN_ID : controllerNetworkConfig.resolvedChain.chainId;
const resolvedChainKind = isLocal ? "slot" : controllerNetworkConfig.resolvedChain.kind;
const controllerSupportedRpcUrls = isLocal ? [rpcUrl] : controllerNetworkConfig.supportedRpcUrls;

console.log("baseRpcUrl", baseRpcUrl);
console.log(
  "[starknet-provider] resolved controller network config",
  JSON.stringify(
    {
      resolvedChainId,
      resolvedChainKind,
      supportedRpcUrlCount: controllerSupportedRpcUrls.length,
    },
    null,
    2,
  ),
);

const controller = new ControllerConnector({
  errorDisplayMode: "notification",
  propagateSessionErrors: true,
  chains: controllerSupportedRpcUrls.map((chainRpcUrl) => ({
    rpcUrl: chainRpcUrl,
  })),
  defaultChainId: resolvedChainId,
  // Policies are intentionally omitted here so that login/connect does NOT
  // create a session upfront. Session policies are set later by
  // refreshSessionPolicies() after the player selects a game and
  // bootstrapGame() patches the manifest with the correct contract addresses.
  // policies: buildPolicies(dojoConfig.manifest),
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
          : resolvedChainKind === "slot"
            ? [getSlotChain(resolvedChainId)]
            : resolvedChainKind === "mainnet"
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
    // Skip bootstrap on standalone factory routes and on the home factory tab.
    if (isFactoryNavigationSurface()) {
      return;
    }

    if (!account || hasPrefetchedRef.current) {
      return;
    }

    const pathWorld = (() => {
      if (typeof window === "undefined") return null;
      const match = window.location.pathname.match(/^\/play\/([^/]+)(?:\/|$)/);
      if (!match || !match[1]) return null;
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    })();

    const activeWorld = getActiveWorld();
    if (!activeWorld && !pathWorld) {
      return;
    }

    hasPrefetchedRef.current = true;

    void bootstrapGame().catch((error) => {
      console.error("[BOOTSTRAP PREFETCH FAILED]", error);
      hasPrefetchedRef.current = false;
    });
  }, [account]);
};

const isFactoryNavigationSurface = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.location.pathname.startsWith("/factory")) {
    return true;
  }

  return window.location.pathname === "/" && new URLSearchParams(window.location.search).get("tab") === "factory";
};
