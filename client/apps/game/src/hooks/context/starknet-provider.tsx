import { useActiveWorldProfile } from "@/runtime/world/use-active-world";
import { useRuntimeChain } from "@/runtime/world/use-selected-chain";
import type { Chain as RuntimeChain } from "@contracts";
import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Chain, mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useMemo } from "react";
import { shortString } from "starknet";
import { env } from "../../../env";
import { APPCHAIN_CHAIN_ID, resolveStarknetRuntimeConfig } from "./starknet-chain-config";
import { namespaceForChain } from "@/dojo/game-scope";
import { useControllerAccount } from "./use-controller-account";


// ==============================================

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const KATANA_CHAIN_NETWORK = "Katana Local";
const KATANA_CHAIN_NAME = "katana";
const KATANA_RPC_URL = "http://localhost:5050";
const fallbackChain = env.VITE_PUBLIC_CHAIN as RuntimeChain;
// The keychain resolves trophies/profile data under this namespace — it must
// match the active world family ("s2" on the appchain, legacy elsewhere).
const namespace: string = namespaceForChain(fallbackChain);
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

// Self-hosted appchain (WP_REALMS_DEV) — RPC from env, Controller connector.
const appchainChain = {
  id: BigInt(APPCHAIN_CHAIN_ID),
  network: "Realms Appchain",
  name: "appchain",
  nativeCurrency: {
    address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [env.VITE_PUBLIC_NODE_URL],
    },
    public: {
      http: [env.VITE_PUBLIC_NODE_URL],
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
  const activeWorld = useActiveWorldProfile();
  const runtimeChain = useRuntimeChain(fallbackChain);
  const baseRpcUrl = useMemo(
    () =>
      resolveWalletProviderBaseRpcUrl({
        runtimeChain,
        profileRpcUrl: activeWorld?.rpcUrl,
        defaultRpcUrl: env.VITE_PUBLIC_NODE_URL,
      }),
    [activeWorld?.rpcUrl, runtimeChain],
  );
  const runtimeConfig = useMemo(
    () =>
      resolveStarknetRuntimeConfig({
        fallbackChain,
        selectedChain: runtimeChain,
        baseRpcUrl,
        cartridgeApiBase,
      }),
    [baseRpcUrl, runtimeChain],
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
        // No Slot project is ever passed: Slot is EoL and the self-hosted
        // appchain has none, so the keychain would resolve a foreign project.
        // The world torii indexes trophies under the s2 namespace, so the
        // keychain profile (achievements/inventory) reads it directly.
        namespace,
        toriiUrl: env.VITE_PUBLIC_TORII || undefined,
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

    if (runtimeConfig.chainKind === "appchain") {
      return [appchainChain];
    }

    if (runtimeConfig.chainKind === "mainnet") {
      return [mainnet];
    }

    return [sepolia];
  }, [runtimeConfig.chainKind]);

  return (
    <StarknetConfig
      key={`${runtimeConfig.chainKind}:${runtimeConfig.defaultChainId}:${runtimeConfig.rpcUrl}`}
      chains={resolvedChains}
      provider={jsonRpcProvider({ rpc })}
      paymasterProvider={
        // local + appchain: katana serves paymaster_* on the node RPC itself.
        // Without an explicit provider, starknet-react probes
        // chain.paymasterRpcUrls.avnu, which custom katana chains don't define.
        runtimeConfig.chainKind === "local" || runtimeConfig.chainKind === "appchain"
          ? paymasterRpcProvider({ rpc: paymasterRpc })
          : undefined
      }
      connectors={runtimeConfig.chainKind === "local" ? predeployedConnectors : [controller as unknown as Connector]}
      explorer={voyager}
      autoConnect
      queryClient={queryClient}
    >
      <StarknetAccountSync>{children}</StarknetAccountSync>
    </StarknetConfig>
  );
}

const resolveWalletProviderBaseRpcUrl = ({
  runtimeChain,
  profileRpcUrl,
  defaultRpcUrl,
}: {
  runtimeChain: RuntimeChain;
  profileRpcUrl?: string;
  defaultRpcUrl: string;
}): string => {
  if (runtimeChain === "local") {
    return KATANA_RPC_URL;
  }

  return profileRpcUrl ?? defaultRpcUrl;
};

const StarknetAccountSync = ({ children }: { children: React.ReactNode }) => {
  useControllerAccount();

  return <>{children}</>;
};
