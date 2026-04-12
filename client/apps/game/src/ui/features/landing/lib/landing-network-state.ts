import type { Chain } from "@contracts";

export type LandingNetworkChain = "mainnet" | "slot";
export type LandingNetworkStatus = "disconnected" | "detecting" | "matched" | "mismatched";

interface LandingNetworkState {
  preferredChain: LandingNetworkChain;
  connectedChain: Chain | null;
  connectedLandingChain: LandingNetworkChain | null;
  hasConnectedWallet: boolean;
  status: LandingNetworkStatus;
}

export const resolvePreferredLandingChain = (chain: Chain | null | undefined): LandingNetworkChain => {
  return chain === "mainnet" ? "mainnet" : "slot";
};

const resolveConnectedLandingChain = (chain: Chain | null | undefined): LandingNetworkChain | null => {
  if (chain === "mainnet") return "mainnet";
  if (chain === "slot") return "slot";
  return null;
};

export const resolveLandingNetworkState = ({
  preferredChain,
  connectedChain,
  hasConnectedWallet,
}: {
  preferredChain: Chain | null | undefined;
  connectedChain: Chain | null | undefined;
  hasConnectedWallet: boolean;
}): LandingNetworkState => {
  const resolvedPreferredChain = resolvePreferredLandingChain(preferredChain);
  const connectedLandingChain = resolveConnectedLandingChain(connectedChain);

  if (!hasConnectedWallet) {
    return {
      preferredChain: resolvedPreferredChain,
      connectedChain: connectedChain ?? null,
      connectedLandingChain,
      hasConnectedWallet,
      status: "disconnected",
    };
  }

  if (!connectedChain) {
    return {
      preferredChain: resolvedPreferredChain,
      connectedChain: null,
      connectedLandingChain,
      hasConnectedWallet,
      status: "detecting",
    };
  }

  return {
    preferredChain: resolvedPreferredChain,
    connectedChain,
    connectedLandingChain,
    hasConnectedWallet,
    status: connectedLandingChain === resolvedPreferredChain ? "matched" : "mismatched",
  };
};

export const canInteractWithLandingChain = (
  landingNetworkState: LandingNetworkState,
  targetChain: LandingNetworkChain,
): boolean => {
  if (!landingNetworkState.hasConnectedWallet) {
    return true;
  }

  if (landingNetworkState.status === "detecting") {
    return false;
  }

  return landingNetworkState.connectedLandingChain === targetChain;
};
