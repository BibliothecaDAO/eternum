import { env } from "../../../../../env";
import { setSelectedChain, useSelectedRuntimeChain } from "@/runtime/world";
import {
  resolveConnectedTxChainFromRuntime,
  switchWalletToChain,
  type WalletChainControllerLike,
} from "@/ui/utils/network-switch";
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

export const useLandingNetworkState = (): LandingNetworkControllerState => {
  const fallbackChain = env.VITE_PUBLIC_CHAIN as Chain;
  const selectedChain = useSelectedRuntimeChain(fallbackChain);
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
