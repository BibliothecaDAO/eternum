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
        isSpectateMode: true,
        hasAccount: true,
        settlementCheckComplete: false,
      }),
    ).toBe(true);
  });

  it("waits for settlement checks before play entry", () => {
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

    expect(phase).toBe("loading");
  });

  it("waits for Eternum settlement to open without offering position selection", () => {
    const phase = resolveGameEntryModalPhase({
      bootstrapStatus: "ready",
      hasPhaseError: false,
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
});

describe("the player's account at game entry", () => {
  const frontier = {
    bootstrapStatus: "ready" as const,
    hasPhaseError: false,
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
