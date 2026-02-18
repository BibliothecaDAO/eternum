import { getActiveWorld, normalizeRpcUrl, patchManifestWithFactory, resolveChain } from "@/runtime/world";
import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Chain as GameChain, getGameManifest } from "@contracts";
import { Chain, getSlotChain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// ==============================================

type DerivedChain = {
  kind: "slot" | "mainnet" | "sepolia";
  chainId: string;
};

const deriveChainFromRpcUrl = (value: string): DerivedChain | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    const path = url.pathname;
    const lowerPath = path.toLowerCase();

    if (lowerPath.includes("/starknet/mainnet")) {
      return { kind: "mainnet", chainId: constants.StarknetChainId.SN_MAIN };
    }

    if (lowerPath.includes("/starknet/sepolia")) {
      return { kind: "sepolia", chainId: constants.StarknetChainId.SN_SEPOLIA };
    }

    const match = path.match(/\/x\/([^/]+)\/katana/i);
    if (!match) return null;

    const slug = match[1];
    const label = `WP_${slug.replace(/-/g, "_").toUpperCase()}`;
    if (label.length > 31) return null;

    return { kind: "slot", chainId: shortString.encodeShortString(label) };
  } catch {
    return null;
  }
};

type ConnectionContext = {
  rpcUrl: string;
  resolvedChain: DerivedChain;
  resolvedChainId: string;
  policyManifest: any;
};

const resolveFallbackChain = (chain: GameChain): DerivedChain => {
  if (chain === "slot") {
    return { kind: "slot", chainId: SLOT_CHAIN_ID };
  }
  if (chain === "slottest") {
    return { kind: "slot", chainId: SLOT_CHAIN_ID_TEST };
  }
  if (chain === "mainnet") {
    return { kind: "mainnet", chainId: constants.StarknetChainId.SN_MAIN };
  }
  return { kind: "sepolia", chainId: constants.StarknetChainId.SN_SEPOLIA };
};

const resolveConnectionContext = (): ConnectionContext => {
  const selectedChain = resolveChain(env.VITE_PUBLIC_CHAIN as GameChain);
  const activeWorld = getActiveWorld();
  const activeRpcUrl = activeWorld?.rpcUrl ? normalizeRpcUrl(activeWorld.rpcUrl) : null;
  const fallbackRpcUrl = normalizeRpcUrl(dojoConfig.rpcUrl || env.VITE_PUBLIC_NODE_URL);
  const rpcUrl = activeRpcUrl ?? fallbackRpcUrl;
  const derivedChain = deriveChainFromRpcUrl(rpcUrl);
  const resolvedChain = derivedChain ?? resolveFallbackChain(selectedChain);
  const resolvedChainId = resolvedChain.chainId;
  const baseManifest = getGameManifest(selectedChain);
  const policyManifest =
    activeWorld?.contractsBySelector && activeWorld.worldAddress
      ? patchManifestWithFactory(baseManifest as any, activeWorld.worldAddress, activeWorld.contractsBySelector)
      : baseManifest;

  return {
    rpcUrl,
    resolvedChain,
    resolvedChainId,
    policyManifest,
  };
};

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
  const [controllerContextVersion, setControllerContextVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshControllerContext = () => {
      setControllerContextVersion((prev) => prev + 1);
    };

    window.addEventListener("eternum:world-selection-changed", refreshControllerContext);
    window.addEventListener("eternum:controller-config-changed", refreshControllerContext);

    return () => {
      window.removeEventListener("eternum:world-selection-changed", refreshControllerContext);
      window.removeEventListener("eternum:controller-config-changed", refreshControllerContext);
    };
  }, []);

  const connectionContext = useMemo(() => resolveConnectionContext(), [controllerContextVersion]);
  const effectiveRpcUrl = isLocal ? KATANA_RPC_URL : connectionContext.rpcUrl;
  const resolvedChain = connectionContext.resolvedChain;
  const resolvedChainId = isLocal ? KATANA_CHAIN_ID : connectionContext.resolvedChainId;
  const policyManifest = connectionContext.policyManifest;

  const controller = useMemo(
    () =>
      new ControllerConnector({
        errorDisplayMode: "notification",
        propagateSessionErrors: true,
        chains: [
          {
            rpcUrl: effectiveRpcUrl,
          },
        ],
        defaultChainId: resolvedChainId,
        policies: buildPolicies(policyManifest),
        slot,
        namespace,
      }),
    [effectiveRpcUrl, resolvedChainId, policyManifest, controllerContextVersion],
  );

  const rpc = useCallback(() => {
    return { nodeUrl: effectiveRpcUrl };
  }, [effectiveRpcUrl]);

  const { connectors: predeployedConnectors } = usePredeployedAccounts({
    rpc: effectiveRpcUrl,
    id: "katana",
    name: "Katana",
  });

  const paymasterRpc = useCallback(() => {
    return { nodeUrl: effectiveRpcUrl };
  }, [effectiveRpcUrl]);

  return (
    <StarknetConfig
      chains={
        isLocal
          ? [katanaLocalChain]
          : resolvedChain.kind === "slot"
            ? [getSlotChain(resolvedChain.chainId)]
            : resolvedChain.kind === "mainnet"
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
