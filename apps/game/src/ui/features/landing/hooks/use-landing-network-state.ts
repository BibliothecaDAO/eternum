import { resolveChain } from "@/runtime/world";
import { resolveConnectedTxChainFromRuntime, type WalletChainControllerLike } from "@/ui/utils/network-switch";
import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { useCallback, useMemo } from "react";

import {
  resolveLandingNetworkState,
  resolvePreferredLandingChain,
  type LandingNetworkChain,
  type LandingNetworkStatus,
} from "../lib/landing-network-state";

interface LandingNetworkControllerState {
  preferredChain: LandingNetworkChain;
  connectedChain: Chain | null;
  connectedLandingChain: LandingNetworkChain | null;
  hasConnectedWallet: boolean;
  status: LandingNetworkStatus;
  selectPreferredChain: (chain: LandingNetworkChain) => void;
  switchToPreferredChain: (chain: LandingNetworkChain) => Promise<boolean>;
}

// Chain selection is not a user concept on this client (tester-gate D2): the
// landing always runs on the build's env chain. Wallet chain switching is gone
// with it — mainnet is a read-only data plane, never a login target.
export const useLandingNetworkState = (): LandingNetworkControllerState => {
  const selectedChain = resolveChain("appchain");
  const { address, chainId, connector } = useAccount();
  const controller = (connector as { controller?: WalletChainControllerLike } | undefined)?.controller ?? null;

  const connectedChain = resolveConnectedTxChainFromRuntime({ chainId, controller });

  const landingNetworkState = useMemo(
    () =>
      resolveLandingNetworkState({
        preferredChain: selectedChain,
        connectedChain,
        hasConnectedWallet: Boolean(address),
      }),
    [address, connectedChain, selectedChain],
  );

  const preferredChain = resolvePreferredLandingChain(selectedChain);

  const selectPreferredChain = useCallback(() => {}, []);

  const switchToPreferredChain = useCallback(
    async (chain: LandingNetworkChain) => chain === preferredChain,
    [preferredChain],
  );

  return {
    ...landingNetworkState,
    preferredChain,
    selectPreferredChain,
    switchToPreferredChain,
  };
};
