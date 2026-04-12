import type { AutoSettleStatus } from "@/hooks/store/use-auto-settle-store";

type AutoSettleRuntimePhase =
  | "off"
  | "armed"
  | "prewarming"
  | "paused-wallet"
  | "paused-network"
  | "opening"
  | "settling"
  | "failed"
  | "completed";

export interface AutoSettleRuntimeInput {
  enabled: boolean;
  persistedStatus: AutoSettleStatus;
  settleAtSec: number;
  nowSec: number;
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
  settleAtSec,
  nowSec,
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

  const isDue = nowSec >= settleAtSec;
  const inPrewarmWindow = nowSec >= settleAtSec - PREWARM_WINDOW_SECONDS;
  const inRefreshWindow = nowSec >= settleAtSec - REFRESH_WINDOW_SECONDS;

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
  settleAtSec,
}: {
  phase: AutoSettleRuntimePhase;
  nowSec: number;
  settleAtSec: number;
}) => {
  switch (phase) {
    case "off":
      return {
        title: "Auto-settle off",
        detail: "You'll need to settle manually when the timer ends.",
      };
    case "armed":
      return {
        title: "Auto-settle on",
        detail: `Settles in ${formatCountdown(settleAtSec - nowSec)}`,
      };
    case "prewarming":
      return {
        title: "Prewarming entry",
        detail: `Settles in ${formatCountdown(settleAtSec - nowSec)}`,
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
