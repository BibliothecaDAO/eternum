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
      entryIntent: "play",
      seasonSettlementComplete: false,
      eternumSettlementMode: "realm",
      hasVillagePass: false,
      hasSeasonPass: false,
      checksComplete: true,
      needsHyperstructureInit: false,
      needsSettlement: false,
      canPlay: false,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("error");
  });

  it("holds registered blitz players in a waiting phase before settlement unlocks", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isForgeMode: false,
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
      needsHyperstructureInit: false,
      needsSettlement: true,
      canPlay: false,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("settlement-waiting");
  });

  it("moves registered blitz players into settlement once the unlock timer ends", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isForgeMode: false,
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
      needsHyperstructureInit: false,
      needsSettlement: true,
      canPlay: false,
      isBlitzSettlementUnlocked: true,
    });

    expect(phase).toBe("settlement");
  });

  it("keeps unregistered new blitz players out of the game before settlement unlocks", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isForgeMode: false,
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
      needsHyperstructureInit: false,
      needsSettlement: false,
      canPlay: false,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("settlement-waiting");
  });

  it("routes unregistered new blitz players into the settle flow once settlement unlocks", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isForgeMode: false,
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
      needsHyperstructureInit: false,
      needsSettlement: false,
      canPlay: false,
      isBlitzSettlementUnlocked: true,
    });

    expect(phase).toBe("settlement");
  });

  it("auto-enters blitz players once settlement is provably complete", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isForgeMode: false,
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
      needsHyperstructureInit: false,
      needsSettlement: false,
      canPlay: true,
      isBlitzSettlementUnlocked: true,
    });

    expect(phase).toBe("ready");
  });

  it("keeps forge mode in loading until the game entry bootstrap is ready", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "loading",
      hasPhaseError: false,
      isForgeMode: true,
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
      needsHyperstructureInit: false,
      needsSettlement: false,
      canPlay: true,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("loading");
  });

  it("surfaces forge mode blocking errors instead of showing the forge action", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: true,
      isForgeMode: true,
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
      needsHyperstructureInit: false,
      needsSettlement: false,
      canPlay: true,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("error");
  });

  it("shows forge mode once the blitz world is ready", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isForgeMode: true,
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
      needsHyperstructureInit: false,
      needsSettlement: false,
      canPlay: true,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("forge");
  });
});
