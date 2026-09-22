// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  isGameEntryPreflightComplete,
  resolveBlitzEntry,
  resolveGameEntryBlockingError,
  resolveGameEntryModalPhase,
  type BlitzEntry,
} from "./game-entry-phase";

describe("game entry phase resolution", () => {
  it("marks spectator preflight complete without waiting for settlement checks", () => {
    expect(
      isGameEntryPreflightComplete({
        isSpectateMode: true,
        settlementCheckComplete: false,
      }),
    ).toBe(true);
  });

  it("waits for settlement checks before blitz play entry", () => {
    expect(
      isGameEntryPreflightComplete({
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
      blitzEntry: null,
      isSpectateMode: false,
      worldMode: "blitz",
      isCheckingWorldAvailability: false,
      hasWorldMeta: true,
      isSeasonMode: false,
      isLoadingVillagePrereqs: false,
      hasVillageRevealResult: false,
      settlementMode: "realm",
      hasVillagePass: false,
      checksComplete: true,
      needsSettlement: false,
      canPlay: false,
      isSettlementUnlocked: false,
    });

    expect(phase).toBe("loading");
  });

  const blitzInput = {
    bootstrapStatus: "ready" as const,
    hasPhaseError: false,
    isBlitzMode: true,
    isSpectateMode: false,
    worldMode: "blitz",
    isCheckingWorldAvailability: false,
    hasWorldMeta: true,
    isSeasonMode: false,
    isLoadingVillagePrereqs: false,
    hasVillageRevealResult: false,
    settlementMode: "realm" as const,
    hasVillagePass: false,
    checksComplete: true,
    needsSettlement: false,
    canPlay: false,
    isSettlementUnlocked: false,
  };

  it.each<[string, boolean, boolean, boolean, BlitzEntry, string]>([
    ["a member of an unready game waits for its realms", true, false, false, "preparing", "settlement"],
    ["a member of a ready game plays", true, true, false, "play", "ready"],
    ["a member of an ended game reviews", true, true, true, "review", "spectate"],
    ["a non-member of an unready game spectates", false, false, false, "spectate", "spectate"],
    ["a non-member of a ready game spectates", false, true, false, "spectate", "spectate"],
    ["a non-member of an ended game reviews", false, true, true, "review", "spectate"],
  ])("%s", (_, isMember, ready, ended, entry, phase) => {
    expect(resolveBlitzEntry({ isMember, ready, ended })).toBe(entry);
    expect(resolveGameEntryModalPhase({ ...blitzInput, blitzEntry: entry })).toBe(phase);
  });

  it("keeps a blitz player loading until the roster fact arrives", () => {
    expect(resolveGameEntryModalPhase({ ...blitzInput, blitzEntry: null })).toBe("loading");
  });

  it("waits for Eternum settlement to open without offering position selection", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
      isBlitzMode: false,
      blitzEntry: null,
      isSpectateMode: false,
      worldMode: "eternum",
      isCheckingWorldAvailability: false,
      hasWorldMeta: true,
      isSeasonMode: true,
      isLoadingVillagePrereqs: false,
      hasVillageRevealResult: false,
      settlementMode: "realm",
      hasVillagePass: false,
      checksComplete: true,
      needsSettlement: false,
      canPlay: false,
      isSettlementUnlocked: false,
    });

    expect(phase).toBe("settlement-waiting");
  });
});

describe("Eternum dev settlement", () => {
  const input = {
    bootstrapStatus: "ready" as const,
    hasPhaseError: false,
    isBlitzMode: false,
    blitzEntry: null,
    isSpectateMode: false,
    worldMode: "eternum",
    isCheckingWorldAvailability: false,
    hasWorldMeta: true,
    isSeasonMode: true,
    isLoadingVillagePrereqs: false,
    hasVillageRevealResult: false,
    settlementMode: "realm" as const,
    hasVillagePass: false,
    checksComplete: true,
    needsSettlement: false,
    canPlay: true,
    isSettlementUnlocked: true,
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
        isSeasonMode: false,
        isBlitzMode: true,
        blitzEntry: "play",
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
      blitzEntry: null,
      isSeasonMode: worldMode === "eternum",
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
      isSettlementUnlocked: true,
    };
    expect(resolveGameEntryModalPhase(input)).toBe("village-pass-required");
    expect(resolveGameEntryModalPhase({ ...input, hasVillagePass: true })).toBe("village-placement");
    expect(resolveGameEntryModalPhase({ ...input, isDevMode: true })).toBe("village-placement");
    expect(resolveGameEntryModalPhase({ ...input, hasVillageRevealResult: true })).toBe("village-reveal");
  });
});
