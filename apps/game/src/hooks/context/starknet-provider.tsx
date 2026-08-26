import { GameplayAccountSync } from "@/hooks/context/gameplay-account-sync";
import { ControllerConnector } from "@cartridge/connector";
import { resolveEndpoint } from "@realms-world/chain";
import { mainnet } from "@starknet-react/chains";
import { StarknetConfig, braavos, jsonRpcProvider, ready, voyager } from "@starknet-react/core";
import { constants } from "starknet";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback } from "react";
import { env } from "../../../env";

const identityRpcUrl = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_RPC_URL, {
  name: "VITE_PUBLIC_IDENTITY_RPC_URL",
  browserFacing: true,
});
// Controller is an identity wallet option only (owner decision, brief "Decisions taken"): it signs the one
// SIWS message on mainnet. No session policies, no paymaster, no game-transaction signing.
// The connector package keeps the first instance and ignores later options — own exactly one.
const controller = new ControllerConnector({
  errorDisplayMode: "notification",
  webauthnPopup: true,
  chains: [{ rpcUrl: env.VITE_PUBLIC_CONTROLLER_RPC_URL || identityRpcUrl }],
  defaultChainId: constants.StarknetChainId.SN_MAIN,
});
const identityConnectors = [controller, ready(), braavos()];

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
