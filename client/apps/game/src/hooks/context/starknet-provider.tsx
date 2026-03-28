import {
  getActiveWorld,
  isRpcUrlCompatibleForChain,
  normalizeRpcUrl,
  resolveActiveWorldChain,
  subscribeToWorldSelectionChange,
} from "@/runtime/world";
import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Chain, getSlotChain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import { QueryClient } from "@tanstack/react-query";
import type { Chain as WorldChain } from "@contracts";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { constants, shortString } from "starknet";
import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { bootstrapGame } from "../../init/bootstrap";
import { useAccountStore } from "../store/use-account-store";
import { useControllerAccount } from "./use-controller-account";

const slot: string = env.VITE_PUBLIC_SLOT;
const namespace = "s1_eternum";
const cartridgeApiBase = env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg";

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_CHAIN_NETWORK = "Katana Local";
const KATANA_CHAIN_NAME = "katana";
const KATANA_RPC_URL = "http://localhost:5050";

const SLOT_CHAIN_ID = "0x57505f455445524e554d5f424c49545a5f534c4f545f34";
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

const resolveDefaultRpcUrl = (chain: WorldChain): string => {
  if (chain === "local") {
    return KATANA_RPC_URL;
  }

  if (chain === "slot" || chain === "slottest") {
    return `${cartridgeApiBase}/x/eternum-blitz-slot-4/katana/rpc/v0_9`;
  }

  return `${cartridgeApiBase}/x/starknet/${chain}/rpc/v0_9`;
};

const resolveRuntimeRpcUrl = (chain: WorldChain): string => {
  const activeWorld = getActiveWorld();
  const activeWorldRpcUrl = activeWorld?.chain === chain ? activeWorld.rpcUrl : null;
  if (activeWorldRpcUrl) {
    return normalizeRpcUrl(activeWorldRpcUrl);
  }

  if (dojoConfig.rpcUrl && isRpcUrlCompatibleForChain(chain, dojoConfig.rpcUrl)) {
    return normalizeRpcUrl(dojoConfig.rpcUrl);
  }

  if (env.VITE_PUBLIC_NODE_URL && isRpcUrlCompatibleForChain(chain, env.VITE_PUBLIC_NODE_URL)) {
    return normalizeRpcUrl(env.VITE_PUBLIC_NODE_URL);
  }

  return normalizeRpcUrl(resolveDefaultRpcUrl(chain));
};

const resolveFallbackChain = (chain: WorldChain): DerivedChain => {
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

const buildControllerSupportedRpcUrls = (rpcUrl: string) =>
  Array.from(
    new Set(
      [
        rpcUrl,
        `${cartridgeApiBase}/x/eternum-blitz-slot-4/katana/rpc/v0_9`,
        `${cartridgeApiBase}/x/starknet/sepolia/rpc/v0_9`,
        `${cartridgeApiBase}/x/starknet/mainnet/rpc/v0_9`,
      ].map((value) => normalizeRpcUrl(value)),
    ),
  );

const getWorldSelectionSnapshot = () => {
  const activeWorld = getActiveWorld();
  return `${activeWorld?.name ?? ""}:${activeWorld?.chain ?? ""}:${activeWorld?.rpcUrl ?? ""}`;
};

const getServerWorldSelectionSnapshot = () => "";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  useSyncExternalStore(subscribeToWorldSelectionChange, getWorldSelectionSnapshot, getServerWorldSelectionSnapshot);

  const runtimeChain = resolveActiveWorldChain(env.VITE_PUBLIC_CHAIN as WorldChain);
  const runtimeRpcUrl = useMemo(() => resolveRuntimeRpcUrl(runtimeChain), [runtimeChain]);
  const resolvedChain = useMemo(
    () =>
      runtimeChain === "local" ? null : (deriveChainFromRpcUrl(runtimeRpcUrl) ?? resolveFallbackChain(runtimeChain)),
    [runtimeChain, runtimeRpcUrl],
  );
  const resolvedChainId = runtimeChain === "local" ? KATANA_CHAIN_ID : resolvedChain!.chainId;
  const controllerSupportedRpcUrls = useMemo(() => buildControllerSupportedRpcUrls(runtimeRpcUrl), [runtimeRpcUrl]);
  const controller = useMemo(
    () =>
      new ControllerConnector({
        errorDisplayMode: "notification",
        propagateSessionErrors: true,
        chains: controllerSupportedRpcUrls.map((chainRpcUrl) => ({
          rpcUrl: chainRpcUrl,
        })),
        defaultChainId: resolvedChainId,
        slot,
        namespace,
      }),
    [controllerSupportedRpcUrls, resolvedChainId],
  );
  const providerKey = `${runtimeChain}:${runtimeRpcUrl}:${resolvedChainId}`;

  const rpc = useCallback(() => {
    return { nodeUrl: runtimeRpcUrl };
  }, [runtimeRpcUrl]);

  const { connectors: predeployedConnectors } = usePredeployedAccounts({
    rpc: runtimeRpcUrl,
    id: "katana",
    name: "Katana",
  });

  const paymasterRpc = useCallback(() => {
    return { nodeUrl: runtimeRpcUrl };
  }, [runtimeRpcUrl]);

  return (
    <StarknetConfig
      key={providerKey}
      chains={
        runtimeChain === "local"
          ? [katanaLocalChain]
          : resolvedChain?.kind === "slot"
            ? [getSlotChain(resolvedChain.chainId)]
            : resolvedChain?.kind === "mainnet"
              ? [mainnet]
              : [sepolia]
      }
      provider={jsonRpcProvider({ rpc })}
      paymasterProvider={runtimeChain === "local" ? paymasterRpcProvider({ rpc: paymasterRpc }) : undefined}
      connectors={runtimeChain === "local" ? predeployedConnectors : [controller as unknown as Connector]}
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
