import { setSelectedChain, useSelectedRuntimeChain } from "@/runtime/world";
import {
  resolveConnectedTxChainFromRuntime,
  switchWalletToChain,
  type WalletChainControllerLike,
} from "@/ui/utils/network-switch";
import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { useCallback, useEffect, useMemo } from "react";

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

const DEFAULT_LANDING_CHAIN: Chain = "mainnet";

// Landing should start on Mainnet for each full page open, while still allowing
// normal Slot/Mainnet switching during the current page session.
let hasDefaultedLandingChainOnPageOpen = false;

const defaultLandingChainOnPageOpen = () => {
  if (hasDefaultedLandingChainOnPageOpen) return;

  hasDefaultedLandingChainOnPageOpen = true;
  setSelectedChain(DEFAULT_LANDING_CHAIN);
};

export const useLandingNetworkState = (): LandingNetworkControllerState => {
  const storedSelectedChain = useSelectedRuntimeChain(DEFAULT_LANDING_CHAIN);
  const shouldStartOnDefaultLandingChain = !hasDefaultedLandingChainOnPageOpen;
  const selectedChain = shouldStartOnDefaultLandingChain ? DEFAULT_LANDING_CHAIN : storedSelectedChain;
  const { address, chainId, connector } = useAccount();
  const controller = (connector as { controller?: WalletChainControllerLike } | undefined)?.controller ?? null;

  useEffect(() => {
    if (!shouldStartOnDefaultLandingChain) return;
    defaultLandingChainOnPageOpen();
  }, [shouldStartOnDefaultLandingChain]);

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

  const selectPreferredChain = useCallback((chain: LandingNetworkChain) => {
    setSelectedChain(chain);
  }, []);

  const switchToPreferredChain = useCallback(
    async (chain: LandingNetworkChain) => {
      const switched = await switchWalletToChain({
        controller,
        targetChain: chain,
      });

      if (switched) {
        setSelectedChain(chain);
      }

      return switched;
    },
    [controller],
  );

  return {
    ...landingNetworkState,
    preferredChain: resolvePreferredLandingChain(selectedChain),
    selectPreferredChain,
    switchToPreferredChain,
  };
};
