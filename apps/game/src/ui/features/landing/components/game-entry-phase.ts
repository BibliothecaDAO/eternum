type GameEntryBootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";

export type GameEntryModalPhase =
  | "loading"
  | "settlement-waiting"
  | "settlement"
  | "village-pass-required"
  | "village-placement"
  | "village-reveal"
  | "ready"
  | "error";

interface ResolveGameEntryBlockingErrorInput {
  worldAvailabilityErrorMessage: string | null;
  isCheckingWorldAvailability: boolean;
  isWorldAvailable: boolean | null;
  hasWorldMeta: boolean;
  worldMode: string;
}

interface ResolveGameEntryModalPhaseInput {
  bootstrapStatus: GameEntryBootstrapStatus;
  hasPhaseError: boolean;
  isBlitzMode: boolean;
  isSpectateMode: boolean;
  worldMode: string;
  isCheckingWorldAvailability: boolean;
  hasWorldMeta: boolean;
  isEternumMode: boolean;
  isLoadingEternumPrereqs: boolean;
  hasVillageRevealResult: boolean;
  eternumSettlementMode: "realm" | "village";
  hasVillagePass: boolean;
  checksComplete: boolean;
  needsSettlement: boolean;
  canPlay: boolean;
  isBlitzSettlementUnlocked: boolean;
}

interface GameEntryPreflightInput {
  isEternumMode: boolean;
  isSpectateMode: boolean;
  settlementCheckComplete: boolean;
}

export const isGameEntryPreflightComplete = ({
  isEternumMode,
  isSpectateMode,
  settlementCheckComplete,
}: GameEntryPreflightInput): boolean => {
  const waitsForPlayerSettlementCheck = !isSpectateMode;

  return !waitsForPlayerSettlementCheck || settlementCheckComplete;
};

const resolveBlitzSettlementPhase = ({
  canPlay,
  isSettlementUnlocked,
}: {
  canPlay: boolean;
  isSettlementUnlocked: boolean;
}): Extract<GameEntryModalPhase, "ready" | "settlement" | "settlement-waiting"> => {
  if (canPlay) {
    return "ready";
  }

  return isSettlementUnlocked ? "settlement" : "settlement-waiting";
};

export const resolveGameEntryBlockingError = ({
  worldAvailabilityErrorMessage,
  isCheckingWorldAvailability,
  isWorldAvailable,
  hasWorldMeta,
  worldMode,
}: ResolveGameEntryBlockingErrorInput): Error | null => {
  if (isCheckingWorldAvailability) {
    return null;
  }

  if (worldAvailabilityErrorMessage) {
    return new Error(worldAvailabilityErrorMessage);
  }

  if (isWorldAvailable === false) {
    return new Error("The selected world is currently unavailable.");
  }

  if (!hasWorldMeta || worldMode === "unknown") {
    return new Error("The selected world metadata could not be loaded.");
  }

  return null;
};

export const resolveGameEntryModalPhase = ({
  bootstrapStatus,
  hasPhaseError,
  isBlitzMode,
  isSpectateMode,
  worldMode,
  isCheckingWorldAvailability,
  hasWorldMeta,
  isEternumMode,
  isLoadingEternumPrereqs,
  hasVillageRevealResult,
  eternumSettlementMode,
  hasVillagePass,
  checksComplete,
  needsSettlement,
  canPlay,
  isBlitzSettlementUnlocked,
}: ResolveGameEntryModalPhaseInput): GameEntryModalPhase => {
  if (hasPhaseError || bootstrapStatus === "error") {
    return "error";
  }

  if (bootstrapStatus !== "ready") {
    return "loading";
  }

  if (isSpectateMode) {
    return "ready";
  }

  if (worldMode === "unknown" || isCheckingWorldAvailability || !hasWorldMeta) {
    return "loading";
  }

  if (isEternumMode) {
    if (eternumSettlementMode === "realm") {
      if (!checksComplete) return "loading";
      return resolveBlitzSettlementPhase({ canPlay, isSettlementUnlocked: isBlitzSettlementUnlocked });
    }
    if (isLoadingEternumPrereqs) {
      return "loading";
    }

    if (hasVillageRevealResult) {
      return "village-reveal";
    }

    return hasVillagePass ? "village-placement" : "village-pass-required";
  }

  if (!checksComplete) {
    return "loading";
  }

  if (isBlitzMode) {
    return resolveBlitzSettlementPhase({
      canPlay,
      isSettlementUnlocked: isBlitzSettlementUnlocked,
    });
  }

  if (needsSettlement) {
    return "settlement";
  }

  return "ready";
};
