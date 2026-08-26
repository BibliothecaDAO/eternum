import { GameplayAccountSync } from "@/hooks/context/gameplay-account-sync";
import { resolveEndpoint } from "@realms-world/chain";
import { mainnet } from "@starknet-react/chains";
import { StarknetConfig, braavos, jsonRpcProvider, ready, voyager } from "@starknet-react/core";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback } from "react";
import { env } from "../../../env";

const identityRpcUrl = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_RPC_URL, {
  name: "VITE_PUBLIC_IDENTITY_RPC_URL",
  browserFacing: true,
});
const identityConnectors = [ready(), braavos()];

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
  const rpc = useCallback(() => ({ nodeUrl: identityRpcUrl }), []);

  return (
    <StarknetConfig
      chains={[mainnet]}
      provider={jsonRpcProvider({ rpc })}
      connectors={identityConnectors}
      explorer={voyager}
      autoConnect
      queryClient={queryClient}
    >
      <GameplayAccountSync>{children}</GameplayAccountSync>
    </StarknetConfig>
  );
}
