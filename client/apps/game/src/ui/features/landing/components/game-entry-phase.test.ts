// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveGameEntryBlockingError, resolveGameEntryModalPhase } from "./game-entry-phase";

describe("game entry phase resolution", () => {
  it("surfaces a blocking error when world metadata settles into an unknown mode", () => {
    const error = resolveGameEntryBlockingError({
      worldAvailabilityErrorMessage: null,
      isCheckingWorldAvailability: false,
      isWorldAvailable: true,
      hasWorldMeta: true,
      worldMode: "unknown",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain("metadata");
  });

  it("treats unresolved world metadata as an error phase once availability loading has finished", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: true,
      isForgeMode: false,
      isBlitzMode: false,
      isSpectateMode: false,
      worldMode: "unknown",
      isCheckingWorldAvailability: false,
      hasWorldMeta: false,
      isEternumMode: false,
      isLoadingEternumPrereqs: false,
      hasVillageRevealResult: false,
      unifiedSettlementPlannerEnabled: false,
      hasSettledRealm: false,
      eternumEntryIntent: "play",
      seasonSettlementComplete: false,
      eternumSettlementMode: "realm",
      hasVillagePass: false,
      hasSeasonPass: false,
      checksComplete: true,
      needsHyperstructureInit: false,
      needsSettlement: false,
    });

    expect(phase).toBe("error");
  });
});
