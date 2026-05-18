// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  isGameEntryPreflightComplete,
  resolveGameEntryBlockingError,
  resolveGameEntryModalPhase,
} from "./game-entry-phase";

describe("game entry phase resolution", () => {
  it("marks spectator preflight complete without waiting for settlement checks", () => {
    expect(
      isGameEntryPreflightComplete({
        isEternumMode: false,
        isSpectateMode: true,
        settlementCheckComplete: false,
      }),
    ).toBe(true);
  });

  it("waits for settlement checks before blitz play entry", () => {
    expect(
      isGameEntryPreflightComplete({
        isEternumMode: false,
        isSpectateMode: false,
        settlementCheckComplete: false,
      }),
    ).toBe(false);
  });

  it("surfaces a blocking error when world metadata resolves to an unknown mode", () => {
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

  it("keeps the modal in loading while bootstrap is incomplete", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "loading",
      hasPhaseError: false,
      isBlitzMode: true,
      isSpectateMode: false,
      worldMode: "blitz",
      isCheckingWorldAvailability: false,
      hasWorldMeta: true,
      isEternumMode: false,
      isLoadingEternumPrereqs: false,
      hasVillageRevealResult: false,
      unifiedSettlementPlannerEnabled: false,
      hasSettledRealm: false,
      entryIntent: "play",
      seasonSettlementComplete: false,
      eternumSettlementMode: "realm",
      hasVillagePass: false,
      hasSeasonPass: false,
      checksComplete: true,
      needsSettlement: false,
      canPlay: false,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("loading");
  });

  it("holds blitz players in the waiting phase before settlement unlocks", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isBlitzMode: true,
      isSpectateMode: false,
      worldMode: "blitz",
      isCheckingWorldAvailability: false,
      hasWorldMeta: true,
      isEternumMode: false,
      isLoadingEternumPrereqs: false,
      hasVillageRevealResult: false,
      unifiedSettlementPlannerEnabled: false,
      hasSettledRealm: false,
      entryIntent: "play",
      seasonSettlementComplete: false,
      eternumSettlementMode: "realm",
      hasVillagePass: false,
      hasSeasonPass: false,
      checksComplete: true,
      needsSettlement: false,
      canPlay: false,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("settlement-waiting");
  });

  it("moves blitz players into settlement once the unlock timer ends", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isBlitzMode: true,
      isSpectateMode: false,
      worldMode: "blitz",
      isCheckingWorldAvailability: false,
      hasWorldMeta: true,
      isEternumMode: false,
      isLoadingEternumPrereqs: false,
      hasVillageRevealResult: false,
      unifiedSettlementPlannerEnabled: false,
      hasSettledRealm: false,
      entryIntent: "play",
      seasonSettlementComplete: false,
      eternumSettlementMode: "realm",
      hasVillagePass: false,
      hasSeasonPass: false,
      checksComplete: true,
      needsSettlement: false,
      canPlay: false,
      isBlitzSettlementUnlocked: true,
    });

    expect(phase).toBe("settlement");
  });

  it("auto-enters blitz players once settlement is complete", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isBlitzMode: true,
      isSpectateMode: false,
      worldMode: "blitz",
      isCheckingWorldAvailability: false,
      hasWorldMeta: true,
      isEternumMode: false,
      isLoadingEternumPrereqs: false,
      hasVillageRevealResult: false,
      unifiedSettlementPlannerEnabled: false,
      hasSettledRealm: false,
      entryIntent: "play",
      seasonSettlementComplete: false,
      eternumSettlementMode: "realm",
      hasVillagePass: false,
      hasSeasonPass: false,
      checksComplete: true,
      needsSettlement: false,
      canPlay: true,
      isBlitzSettlementUnlocked: true,
    });

    expect(phase).toBe("ready");
  });

  it("keeps eternum planner worlds in the planner flow until the player is ready to enter", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isBlitzMode: false,
      isSpectateMode: false,
      worldMode: "eternum",
      isCheckingWorldAvailability: false,
      hasWorldMeta: true,
      isEternumMode: true,
      isLoadingEternumPrereqs: false,
      hasVillageRevealResult: false,
      unifiedSettlementPlannerEnabled: true,
      hasSettledRealm: false,
      entryIntent: "play",
      seasonSettlementComplete: false,
      eternumSettlementMode: "realm",
      hasVillagePass: false,
      hasSeasonPass: true,
      checksComplete: true,
      needsSettlement: false,
      canPlay: false,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("settlement-planner");
  });
});
