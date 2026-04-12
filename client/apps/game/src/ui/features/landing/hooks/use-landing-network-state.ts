import { env } from "../../../../../env";
import { resolveChain, setSelectedChain, subscribeSelectedChain } from "@/runtime/world";
import {
  resolveConnectedTxChainFromRuntime,
  switchWalletToChain,
  type WalletChainControllerLike,
} from "@/ui/utils/network-switch";
import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  resolveLandingNetworkState,
  resolvePreferredLandingChain,
  type LandingNetworkChain,
} from "../lib/landing-network-state";

interface LandingNetworkControllerState {
  preferredChain: LandingNetworkChain;
  connectedChain: Chain | null;
  connectedLandingChain: LandingNetworkChain | null;
  hasConnectedWallet: boolean;
  status: "disconnected" | "detecting" | "matched" | "mismatched";
  selectPreferredChain: (chain: LandingNetworkChain) => void;
  switchToPreferredChain: (chain: LandingNetworkChain) => Promise<boolean>;
}

export const useLandingNetworkState = (): LandingNetworkControllerState => {
  const fallbackChain = env.VITE_PUBLIC_CHAIN as Chain;
  const [selectedChain, setSelectedChainState] = useState<Chain>(() => resolveChain(fallbackChain));
  const { address, chainId, connector } = useAccount();
  const controller = (connector as { controller?: WalletChainControllerLike } | undefined)?.controller ?? null;

  useEffect(() => {
    return subscribeSelectedChain((nextChain) => {
      setSelectedChainState(nextChain ?? fallbackChain);
    });
  }, [fallbackChain]);

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
