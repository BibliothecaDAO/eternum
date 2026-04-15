type GameEntryBootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";

export type GameEntryModalPhase =
  | "loading"
  | "forge"
  | "hyperstructure"
  | "settlement-waiting"
  | "settlement"
  | "settlement-planner"
  | "season-pass-required"
  | "season-placement"
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
  isForgeMode: boolean;
  isBlitzMode: boolean;
  isSpectateMode: boolean;
  worldMode: string;
  isCheckingWorldAvailability: boolean;
  hasWorldMeta: boolean;
  isEternumMode: boolean;
  isLoadingEternumPrereqs: boolean;
  hasVillageRevealResult: boolean;
  unifiedSettlementPlannerEnabled: boolean;
  hasSettledRealm: boolean;
  entryIntent: "play" | "settle";
  seasonSettlementComplete: boolean;
  eternumSettlementMode: "realm" | "village";
  hasVillagePass: boolean;
  hasSeasonPass: boolean;
  checksComplete: boolean;
  needsHyperstructureInit: boolean;
  needsSettlement: boolean;
  isBlitzSettlementUnlocked: boolean;
}

export const resolveBlitzSettlementPhase = ({
  needsSettlement,
  isSettlementUnlocked,
}: {
  needsSettlement: boolean;
  isSettlementUnlocked: boolean;
}): Extract<GameEntryModalPhase, "ready" | "settlement" | "settlement-waiting"> => {
  if (!needsSettlement) {
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
  isForgeMode,
  isBlitzMode,
  isSpectateMode,
  worldMode,
  isCheckingWorldAvailability,
  hasWorldMeta,
  isEternumMode,
  isLoadingEternumPrereqs,
  hasVillageRevealResult,
  unifiedSettlementPlannerEnabled,
  hasSettledRealm,
  entryIntent,
  seasonSettlementComplete,
  eternumSettlementMode,
  hasVillagePass,
  hasSeasonPass,
  checksComplete,
  needsHyperstructureInit,
  needsSettlement,
  isBlitzSettlementUnlocked,
}: ResolveGameEntryModalPhaseInput): GameEntryModalPhase => {
  if (isForgeMode && isBlitzMode) {
    return "forge";
  }

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
    if (isLoadingEternumPrereqs) {
      return "loading";
    }

    if (hasVillageRevealResult) {
      return "village-reveal";
    }

    if (unifiedSettlementPlannerEnabled) {
      return hasSettledRealm && entryIntent === "play" && !seasonSettlementComplete ? "ready" : "settlement-planner";
    }

    if (eternumSettlementMode === "village") {
      return hasVillagePass ? "village-placement" : "village-pass-required";
    }

    if (seasonSettlementComplete || (hasSettledRealm && entryIntent === "play")) {
      return "ready";
    }

    return hasSeasonPass ? "season-placement" : "season-pass-required";
  }

  if (!checksComplete) {
    return "loading";
  }

  if (needsHyperstructureInit) {
    return "hyperstructure";
  }

  if (isBlitzMode) {
    return resolveBlitzSettlementPhase({
      needsSettlement,
      isSettlementUnlocked: isBlitzSettlementUnlocked,
    });
  }

  if (needsSettlement) {
    return "settlement";
  }

  return "ready";
};
