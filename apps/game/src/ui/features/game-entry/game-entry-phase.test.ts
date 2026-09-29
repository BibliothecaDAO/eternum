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
        hasAccount: true,
        settlementCheckComplete: false,
      }),
    ).toBe(true);
  });

  it("waits for settlement checks before blitz play entry", () => {
    expect(
      isGameEntryPreflightComplete({
        isSpectateMode: false,
        hasAccount: true,
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
    expect(error?.message).toContain("settings");
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
      checksComplete: true,
      needsSettlement: false,
      canPlay: false,
      isSettlementUnlocked: false,
      hasAccount: true,
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
    checksComplete: true,
    needsSettlement: false,
    canPlay: false,
    isSettlementUnlocked: false,
    hasAccount: true,
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
      checksComplete: true,
      needsSettlement: false,
      canPlay: false,
      isSettlementUnlocked: false,
      hasAccount: true,
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
    checksComplete: true,
    needsSettlement: false,
    canPlay: true,
    isSettlementUnlocked: true,
    hasAccount: true,
  };
  it("allows another realm only for dev games", () => {
    expect(resolveGameEntryModalPhase({ ...input, isEternumDevMode: true, isSettlingAdditionalRealm: true })).toBe(
      "settlement",
    );
    expect(resolveGameEntryModalPhase({ ...input, isEternumDevMode: false, isSettlingAdditionalRealm: true })).toBe(
      "ready",
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

describe("the player's account at game entry", () => {
  const frontier = {
    bootstrapStatus: "ready" as const,
    hasPhaseError: false,
    isBlitzMode: false,
    blitzEntry: null,
    isSpectateMode: false,
    worldMode: "frontier",
    isCheckingWorldAvailability: false,
    hasWorldMeta: true,
    hasAccount: false,
    isSeasonMode: true,
    checksComplete: false,
    needsSettlement: false,
    canPlay: false,
    isSettlementUnlocked: true,
  };

  it("offers no way to play before the account exists", () => {
    expect(resolveGameEntryModalPhase(frontier)).toBe("account");
    expect(
      resolveGameEntryModalPhase({ ...frontier, worldMode: "blitz", isSeasonMode: false, isBlitzMode: true }),
    ).toBe("account");
  });

  it("founds once the account has joined", () => {
    expect(resolveGameEntryModalPhase({ ...frontier, hasAccount: true, checksComplete: true })).toBe("settlement");
  });

  it("hands a player without an account from the loader to the account phase", () => {
    expect(
      isGameEntryPreflightComplete({ isSpectateMode: false, hasAccount: false, settlementCheckComplete: false }),
    ).toBe(true);
  });

  it("lets a spectator in without an account", () => {
    expect(resolveGameEntryModalPhase({ ...frontier, isSpectateMode: true })).toBe("ready");
  });
});
