type GameEntryBootstrapStatus = "idle" | "pending-world" | "loading" | "ready" | "error";

export type GameEntryModalPhase =
  | "loading"
  | "settlement-waiting"
  | "settlement"
  | "spectate"
  | "village-pass-required"
  | "village-placement"
  | "village-reveal"
  | "ready"
  | "error";

/** What a Blitz game offers the connected player: play, wait for the roster's realms, or watch. */
export type BlitzEntry = "play" | "preparing" | "spectate" | "review";

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
  blitzEntry: BlitzEntry | null;
  isSpectateMode: boolean;
  worldMode: string;
  isCheckingWorldAvailability: boolean;
  hasWorldMeta: boolean;
  isSeasonMode: boolean;
  isLoadingVillagePrereqs: boolean;
  hasVillageRevealResult: boolean;
  settlementMode: "realm" | "village";
  hasVillagePass: boolean;
  isEternumDevMode?: boolean;
  isDevMode?: boolean;
  isSettlingAdditionalRealm?: boolean;
  checksComplete: boolean;
  needsSettlement: boolean;
  canPlay: boolean;
  isSettlementUnlocked: boolean;
}

interface GameEntryPreflightInput {
  isSpectateMode: boolean;
  settlementCheckComplete: boolean;
}

export const isGameEntryPreflightComplete = ({
  isSpectateMode,
  settlementCheckComplete,
}: GameEntryPreflightInput): boolean => isSpectateMode || settlementCheckComplete;

/** Membership is the roster fact; readiness and the end of the game decide what a member may do. */
export const resolveBlitzEntry = ({
  isMember,
  ready,
  ended,
}: {
  isMember: boolean;
  ready: boolean;
  ended: boolean;
}): BlitzEntry => {
  if (ended) return "review";
  if (!isMember) return "spectate";
  return ready ? "play" : "preparing";
};

const resolveBlitzPhase = (entry: BlitzEntry): Extract<GameEntryModalPhase, "ready" | "settlement" | "spectate"> => {
  if (entry === "play") return "ready";
  if (entry === "preparing") return "settlement";
  return "spectate";
};

const resolveEternumSettlementPhase = ({
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
  blitzEntry,
  isSpectateMode,
  worldMode,
  isCheckingWorldAvailability,
  hasWorldMeta,
  isSeasonMode,
  isLoadingVillagePrereqs,
  hasVillageRevealResult,
  settlementMode,
  hasVillagePass,
  isEternumDevMode = false,
  isDevMode = false,
  isSettlingAdditionalRealm = false,
  checksComplete,
  needsSettlement,
  canPlay,
  isSettlementUnlocked,
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

  if (settlementMode === "village") {
    if (isLoadingVillagePrereqs) return "loading";
    if (hasVillageRevealResult) return "village-reveal";
    return hasVillagePass || isDevMode ? "village-placement" : "village-pass-required";
  }

  if (isSeasonMode) {
    if (!checksComplete) return "loading";
    return resolveEternumSettlementPhase({
      canPlay: canPlay && !(isEternumDevMode && isSettlingAdditionalRealm),
      isSettlementUnlocked,
    });
  }

  if (!checksComplete) {
    return "loading";
  }

  if (isBlitzMode) {
    return blitzEntry ? resolveBlitzPhase(blitzEntry) : "loading";
  }

  if (needsSettlement) {
    return "settlement";
  }

  return "ready";
};
