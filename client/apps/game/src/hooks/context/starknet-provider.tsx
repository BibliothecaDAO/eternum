import {
  WORLD_SELECTION_CHANGED_EVENT,
  getActiveWorld,
  normalizeRpcUrl,
  patchManifestWithFactory,
  resolveChain,
} from "@/runtime/world";
import { Chain as GameChain, getGameManifest } from "@contracts";
import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Chain as StarknetChain, getSlotChain, mainnet, sepolia } from "@starknet-react/chains";
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

// ==============================================

const SLOT_CHAIN_ID = "0x57505f455445524e554d5f424c49545a5f534c4f545f33";

const SLOT_CHAIN_ID_TEST = "0x57505f455445524e554d5f424c49545a5f534c4f545f54455354";

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

type RuntimeConnectorConfig = {
  connectorKey: string;
  isLocal: boolean;
  resolvedChain: DerivedChain;
  resolvedChainId: string;
  rpcUrl: string;
  policyManifest: Record<string, unknown>;
};

const getRuntimeConnectorConfig = (): RuntimeConnectorConfig => {
  const selectedChain = resolveChain(env.VITE_PUBLIC_CHAIN as GameChain);
  const isLocal = selectedChain === "local";
  const isSlot = selectedChain === "slot";
  const isSlottest = selectedChain === "slottest";
  const activeWorld = getActiveWorld();

  const baseRpcUrl = isLocal ? KATANA_RPC_URL : activeWorld?.rpcUrl || dojoConfig.rpcUrl || env.VITE_PUBLIC_NODE_URL;
  const rpcUrl = normalizeRpcUrl(baseRpcUrl);

  const derivedChain = isLocal ? null : deriveChainFromRpcUrl(rpcUrl);
  const fallbackChain: DerivedChain = isSlot
    ? { kind: "slot", chainId: SLOT_CHAIN_ID }
    : isSlottest
      ? { kind: "slot", chainId: SLOT_CHAIN_ID_TEST }
      : selectedChain === "mainnet"
        ? { kind: "mainnet", chainId: constants.StarknetChainId.SN_MAIN }
        : { kind: "sepolia", chainId: constants.StarknetChainId.SN_SEPOLIA };
  const resolvedChain = derivedChain ?? fallbackChain;
  const resolvedChainId = isLocal ? KATANA_CHAIN_ID : resolvedChain.chainId;

  let policyManifest = dojoConfig.manifest as Record<string, unknown>;
  const baseManifest = getGameManifest(selectedChain);
  if (activeWorld?.contractsBySelector && activeWorld.worldAddress) {
    policyManifest = patchManifestWithFactory(
      baseManifest as Record<string, unknown>,
      activeWorld.worldAddress,
      activeWorld.contractsBySelector,
    ) as Record<string, unknown>;
  }

  const connectorKey = [selectedChain, activeWorld?.name ?? "none", resolvedChainId, rpcUrl].join(":");

  return {
    connectorKey,
    isLocal,
    resolvedChain,
    resolvedChainId,
    rpcUrl,
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
} as const satisfies StarknetChain;

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
  const [selectionVersion, setSelectionVersion] = useState(0);

  useEffect(() => {
    const onWorldSelectionChanged = () => {
      setSelectionVersion((current) => current + 1);
    };

    window.addEventListener(WORLD_SELECTION_CHANGED_EVENT, onWorldSelectionChanged);
    window.addEventListener("storage", onWorldSelectionChanged);
    return () => {
      window.removeEventListener(WORLD_SELECTION_CHANGED_EVENT, onWorldSelectionChanged);
      window.removeEventListener("storage", onWorldSelectionChanged);
    };
  }, []);

  const runtimeConfig = useMemo(() => {
    // Explicit refresh trigger from world-selection events.
    void selectionVersion;
    return getRuntimeConnectorConfig();
  }, [selectionVersion]);
  const providerKey = `${runtimeConfig.connectorKey}:${selectionVersion}`;

  const controllerConnector = useMemo(() => {
    void selectionVersion;
    void runtimeConfig.connectorKey;
    return new ControllerConnector({
      errorDisplayMode: "notification",
      propagateSessionErrors: true,
      chains: [
        {
          rpcUrl: runtimeConfig.rpcUrl,
        },
      ],
      defaultChainId: runtimeConfig.resolvedChainId,
      policies: buildPolicies(runtimeConfig.policyManifest),
      slot,
      namespace,
    });
  }, [
    runtimeConfig.connectorKey,
    runtimeConfig.policyManifest,
    runtimeConfig.resolvedChainId,
    runtimeConfig.rpcUrl,
    selectionVersion,
  ]);

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

  return (
    <StarknetConfig
      key={providerKey}
      chains={
        runtimeConfig.isLocal
          ? [katanaLocalChain]
          : runtimeConfig.resolvedChain.kind === "slot"
            ? [getSlotChain(runtimeConfig.resolvedChain.chainId)]
            : runtimeConfig.resolvedChain.kind === "mainnet"
              ? [mainnet]
              : [sepolia]
      }
      provider={jsonRpcProvider({ rpc })}
      paymasterProvider={runtimeConfig.isLocal ? paymasterRpcProvider({ rpc: paymasterRpc }) : undefined}
      connectors={runtimeConfig.isLocal ? predeployedConnectors : [controllerConnector as unknown as Connector]}
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
