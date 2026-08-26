import { resolveChain } from "@/runtime/world";
import type { GameChain as Chain } from "@realms-world/chain";
import { useAccountStore } from "@/hooks/store/use-account-store";
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
  const selectedChain = resolveChain("madara");
  const hasGameplayAccount = useAccountStore((state) => Boolean(state.account));
  const connectedChain = hasGameplayAccount ? selectedChain : null;

  const landingNetworkState = useMemo(
    () =>
      resolveLandingNetworkState({
        preferredChain: selectedChain,
        connectedChain,
        hasConnectedWallet: hasGameplayAccount,
      }),
    [connectedChain, hasGameplayAccount, selectedChain],
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
