import type { AutoSettleStatus } from "@/hooks/store/use-auto-settle-store";

import { resolveBlitzSettlementAvailability } from "../game-entry-blitz-timing";

type AutoSettleRuntimePhase =
  | "off"
  | "armed"
  | "prewarming"
  | "ready-manual"
  | "paused-wallet"
  | "paused-network"
  | "opening"
  | "settling"
  | "failed"
  | "completed";

export interface AutoSettleRuntimeInput {
  enabled: boolean;
  persistedStatus: AutoSettleStatus;
  unlockAtSec: number | null;
  nowSec: number;
  opensOnUnlockEdge: boolean;
  hasConnectedWallet: boolean;
  hasCompatibleNetwork: boolean;
}

interface AutoSettleRuntimeState {
  phase: AutoSettleRuntimePhase;
  shouldPrimeAssets: boolean;
  shouldRefreshAvailability: boolean;
  shouldOpenEntry: boolean;
}

const PREWARM_WINDOW_SECONDS = 30;
const REFRESH_WINDOW_SECONDS = 5;

export const resolveAutoSettleRuntimeState = ({
  enabled,
  persistedStatus,
  unlockAtSec,
  nowSec,
  opensOnUnlockEdge,
  hasConnectedWallet,
  hasCompatibleNetwork,
}: AutoSettleRuntimeInput): AutoSettleRuntimeState => {
  if (!enabled || persistedStatus === "idle") {
    return {
      phase: "off",
      shouldPrimeAssets: false,
      shouldRefreshAvailability: false,
      shouldOpenEntry: false,
    };
  }

  if (persistedStatus === "opening") {
    return {
      phase: "opening",
      shouldPrimeAssets: false,
      shouldRefreshAvailability: false,
      shouldOpenEntry: false,
    };
  }

  if (persistedStatus === "settling") {
    return {
      phase: "settling",
      shouldPrimeAssets: false,
      shouldRefreshAvailability: false,
      shouldOpenEntry: false,
    };
  }

  if (persistedStatus === "failed") {
    return {
      phase: "failed",
      shouldPrimeAssets: false,
      shouldRefreshAvailability: false,
      shouldOpenEntry: false,
    };
  }

  if (persistedStatus === "completed") {
    return {
      phase: "completed",
      shouldPrimeAssets: false,
      shouldRefreshAvailability: false,
      shouldOpenEntry: false,
    };
  }

  const availability = resolveBlitzSettlementAvailability({
    startMainAt: unlockAtSec,
    nowSec,
  });
  const resolvedUnlockAtSec = availability.unlockAtSec;
  const isDue = availability.isUnlocked;
  const inPrewarmWindow = resolvedUnlockAtSec != null && nowSec >= resolvedUnlockAtSec - PREWARM_WINDOW_SECONDS;
  const inRefreshWindow = resolvedUnlockAtSec != null && nowSec >= resolvedUnlockAtSec - REFRESH_WINDOW_SECONDS;

  if (!opensOnUnlockEdge && isDue) {
    return {
      phase: "ready-manual",
      shouldPrimeAssets: false,
      shouldRefreshAvailability: false,
      shouldOpenEntry: false,
    };
  }

  if (!hasConnectedWallet) {
    return {
      phase: "paused-wallet",
      shouldPrimeAssets: false,
      shouldRefreshAvailability: inRefreshWindow,
      shouldOpenEntry: false,
    };
  }

  if (!hasCompatibleNetwork) {
    return {
      phase: "paused-network",
      shouldPrimeAssets: false,
      shouldRefreshAvailability: inRefreshWindow,
      shouldOpenEntry: false,
    };
  }

  if (isDue) {
    return {
      phase: "opening",
      shouldPrimeAssets: false,
      shouldRefreshAvailability: true,
      shouldOpenEntry: true,
    };
  }

  if (inPrewarmWindow) {
    return {
      phase: "prewarming",
      shouldPrimeAssets: true,
      shouldRefreshAvailability: inRefreshWindow,
      shouldOpenEntry: false,
    };
  }

  return {
    phase: "armed",
    shouldPrimeAssets: false,
    shouldRefreshAvailability: false,
    shouldOpenEntry: false,
  };
};

const formatCountdown = (secondsLeft: number): string => {
  const total = Math.max(0, Math.floor(secondsLeft));
  const hours = Math.floor(total / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
};

export const describeAutoSettleRuntimePhase = ({
  phase,
  nowSec,
  unlockAtSec,
}: {
  phase: AutoSettleRuntimePhase;
  nowSec: number;
  unlockAtSec: number | null;
}) => {
  const availability = resolveBlitzSettlementAvailability({
    startMainAt: unlockAtSec,
    nowSec,
  });
  const secondsUntilUnlock = availability.secondsUntilUnlock ?? 0;

  switch (phase) {
    case "off":
      return {
        title: "Auto-settle off",
        detail: "You'll need to settle manually when the timer ends.",
      };
    case "armed":
      return {
        title: "Auto-settle on",
        detail: `Settles in ${formatCountdown(secondsUntilUnlock)}`,
      };
    case "prewarming":
      return {
        title: "Prewarming entry",
        detail: `Settles in ${formatCountdown(secondsUntilUnlock)}`,
      };
    case "ready-manual":
      return {
        title: "Settlement ready",
        detail: "Auto-settle is armed, but this registration stays on the dashboard. Click Play to settle manually.",
      };
    case "paused-wallet":
      return {
        title: "Paused: reconnect wallet",
        detail: "Auto-settle resumes once your wallet session returns.",
      };
    case "paused-network":
      return {
        title: "Paused: switch network",
        detail: "Auto-settle resumes once your wallet matches the game chain.",
      };
    case "opening":
      return {
        title: "Opening game",
        detail: "Preparing the settlement flow now.",
      };
    case "settling":
      return {
        title: "Attempting settlement",
        detail: "Submitting your settlement automatically.",
      };
    case "failed":
      return {
        title: "Settlement failed",
        detail: "Retry manually from the game card.",
      };
    case "completed":
      return {
        title: "Auto-settle complete",
        detail: "You should already be entering the game.",
      };
  }
};
