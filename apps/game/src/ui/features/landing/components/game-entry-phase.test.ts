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
      isLoadingVillagePrereqs: false,
      hasVillageRevealResult: false,
      settlementMode: "realm",
      hasVillagePass: false,
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
      isLoadingVillagePrereqs: false,
      hasVillageRevealResult: false,
      settlementMode: "realm",
      hasVillagePass: false,
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
      isLoadingVillagePrereqs: false,
      hasVillageRevealResult: false,
      settlementMode: "realm",
      hasVillagePass: false,
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
      isLoadingVillagePrereqs: false,
      hasVillageRevealResult: false,
      settlementMode: "realm",
      hasVillagePass: false,
      checksComplete: true,
      needsSettlement: false,
      canPlay: true,
      isBlitzSettlementUnlocked: true,
    });

    expect(phase).toBe("ready");
  });

  it("waits for Eternum settlement to open without offering position selection", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isBlitzMode: false,
      isSpectateMode: false,
      worldMode: "eternum",
      isCheckingWorldAvailability: false,
      hasWorldMeta: true,
      isEternumMode: true,
      isLoadingVillagePrereqs: false,
      hasVillageRevealResult: false,
      settlementMode: "realm",
      hasVillagePass: false,
      checksComplete: true,
      needsSettlement: false,
      canPlay: false,
      isBlitzSettlementUnlocked: false,
    });

    expect(phase).toBe("settlement-waiting");
  });
});

describe("Eternum dev settlement", () => {
  const input = {
    bootstrapStatus: "ready" as const,
    hasPhaseError: false,
    isBlitzMode: false,
    isSpectateMode: false,
    worldMode: "eternum",
    isCheckingWorldAvailability: false,
    hasWorldMeta: true,
    isEternumMode: true,
    isLoadingVillagePrereqs: false,
    hasVillageRevealResult: false,
    settlementMode: "realm" as const,
    hasVillagePass: false,
    checksComplete: true,
    needsSettlement: false,
    canPlay: true,
    isBlitzSettlementUnlocked: true,
  };
  it("allows another realm only for dev games", () => {
    expect(resolveGameEntryModalPhase({ ...input, isEternumDevMode: true, isSettlingAdditionalRealm: true })).toBe(
      "settlement",
    );
    expect(resolveGameEntryModalPhase({ ...input, isEternumDevMode: false, isSettlingAdditionalRealm: true })).toBe(
      "ready",
    );
  });
  it("allows village placement without a pass only for dev games", () => {
    expect(resolveGameEntryModalPhase({ ...input, settlementMode: "village", isDevMode: true })).toBe(
      "village-placement",
    );
    expect(resolveGameEntryModalPhase({ ...input, settlementMode: "village", isDevMode: false })).toBe(
      "village-pass-required",
    );
  });
  it("keeps settled Blitz players in the ready phase", () => {
    expect(
      resolveGameEntryModalPhase({
        ...input,
        worldMode: "blitz",
        isEternumMode: false,
        isBlitzMode: true,
        isEternumDevMode: true,
        isSettlingAdditionalRealm: true,
      }),
    ).toBe("ready");
  });
});

describe("village placement across modes", () => {
  it.each(["blitz", "eternum"])("requires a pass outside dev mode in %s", (worldMode) => {
    const input = {
      bootstrapStatus: "ready" as const,
      hasPhaseError: false,
      isBlitzMode: worldMode === "blitz",
      isEternumMode: worldMode === "eternum",
      isSpectateMode: false,
      worldMode,
      isCheckingWorldAvailability: false,
      hasWorldMeta: true,
      isLoadingVillagePrereqs: false,
      hasVillageRevealResult: false,
      settlementMode: "village" as const,
      hasVillagePass: false,
      checksComplete: true,
      needsSettlement: false,
      canPlay: true,
      isBlitzSettlementUnlocked: true,
    };
    expect(resolveGameEntryModalPhase(input)).toBe("village-pass-required");
    expect(resolveGameEntryModalPhase({ ...input, hasVillagePass: true })).toBe("village-placement");
    expect(resolveGameEntryModalPhase({ ...input, isDevMode: true })).toBe("village-placement");
    expect(resolveGameEntryModalPhase({ ...input, hasVillageRevealResult: true })).toBe("village-reveal");
  });
});
