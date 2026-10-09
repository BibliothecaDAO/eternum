import { ControllerConnector } from "@cartridge/connector";
import { mainnet } from "@starknet-react/chains";
import { StarknetConfig, braavos, jsonRpcProvider, ready, voyager } from "@starknet-react/core";
import { constants } from "starknet";
import { WebWalletConnector } from "starknetkit/webwallet";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback } from "react";
import { MAINNET_RPC_URL } from "@/runtime/mainnet-rpc";

// Controller is a wallet a player links to their Realms account from the account page: it signs
// the one SIWS message on mainnet. No session policies, no paymaster, no game-transaction signing.
// The connector package keeps the first instance and ignores later options — own exactly one.
// `lazyload`: the keychain iframe (Cartridge's hosted keychain, an authed gRPC client of its own) is created on the first
// wallet action, not at module load — an anonymous spectator never starts a vendor client that needs a session.
const controller = new ControllerConnector({
  errorDisplayMode: "notification",
  webauthnPopup: true,
  lazyload: true,
  // Identity is always mainnet. Pass that fact through so Controller does not synchronously probe an RPC at boot.
  chains: [{ rpcUrl: MAINNET_RPC_URL, chainId: constants.StarknetChainId.SN_MAIN }],
  defaultChainId: constants.StarknetChainId.SN_MAIN,
});
// Ready's email wallet: Ready's own page holds the keys, shown over ours; a phone browser has no wallet extension.
const readyByEmail = new WebWalletConnector({ url: "https://web.ready.co" });
const identityConnectors = [controller, ready(), readyByEmail, braavos()];

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
  const rpc = useCallback(() => ({ nodeUrl: MAINNET_RPC_URL }), []);

  return (
    <StarknetConfig
      chains={[mainnet]}
      provider={jsonRpcProvider({ rpc })}
      connectors={identityConnectors}
      explorer={voyager}
      queryClient={queryClient}
    >
      {children}
    </StarknetConfig>
  );
}
