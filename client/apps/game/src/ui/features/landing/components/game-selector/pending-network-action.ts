import type { Chain } from "@contracts";

type PendingNetworkActionContext = "game" | "market";

interface PendingNetworkAction {
  targetChain: Chain;
  context: PendingNetworkActionContext;
  replay: () => void;
}

interface PendingNetworkSwitchOutcome {
  pendingAction: PendingNetworkAction | null;
  replay: (() => void) | null;
  selectedChain: Chain | null;
}

export const createPendingNetworkAction = (
  targetChain: Chain,
  context: PendingNetworkActionContext,
  replay: () => void,
): PendingNetworkAction => ({
  targetChain,
  context,
  replay,
});

export const resolvePendingNetworkSwitchOutcome = ({
  pendingAction,
  latestPendingAction = null,
  switched,
}: {
  pendingAction: PendingNetworkAction | null;
  latestPendingAction?: PendingNetworkAction | null;
  switched: boolean;
}): PendingNetworkSwitchOutcome => {
  if (!pendingAction) {
    return {
      pendingAction: latestPendingAction,
      replay: null,
      selectedChain: null,
    };
  }

  if (!switched) {
    return {
      pendingAction: latestPendingAction ?? pendingAction,
      replay: null,
      selectedChain: null,
    };
  }

  if (latestPendingAction !== pendingAction) {
    return {
      pendingAction: latestPendingAction,
      replay: null,
      selectedChain: null,
    };
  }

  return {
    pendingAction: null,
    replay: pendingAction.replay,
    selectedChain: pendingAction.targetChain,
  };
};

export type { PendingNetworkAction };
