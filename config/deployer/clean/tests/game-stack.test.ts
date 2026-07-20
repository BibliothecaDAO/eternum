import { describe, expect, test } from "bun:test";
import { createBlitzLaunchQuote } from "../game-stack/policy";
import { deriveGameStackOperationalPhase } from "../game-stack/types";

describe("Blitz game-stack launch policy", () => {
  test("derives the coarse operational phase from the normative protocol lifecycle", () => {
    expect(deriveGameStackOperationalPhase("Intent")).toBe("reserving");
    expect(deriveGameStackOperationalPhase("Provisioning")).toBe("provisioning-l3");
    expect(deriveGameStackOperationalPhase("ProvisioningIdentitySealed")).toBe("provisioning-l3");
    expect(deriveGameStackOperationalPhase("Attested")).toBe("deploying-world");
    expect(
      deriveGameStackOperationalPhase("Attested", {
        worldReadyAt: "2026-07-18T12:30:00.000Z",
        indexerReadyAt: "2026-07-18T12:35:00.000Z",
        registryVerifiedAt: "2026-07-18T12:40:00.000Z",
      }),
    ).toBe("deploying-world");
    expect(
      deriveGameStackOperationalPhase("Attested", {
        identitySealedAt: "2026-07-18T12:20:00.000Z",
        attestationVerifiedAt: "2026-07-18T12:25:00.000Z",
        worldReadyAt: "2026-07-18T12:30:00.000Z",
      }),
    ).toBe("provisioning-indexer");
    expect(
      deriveGameStackOperationalPhase("Attested", {
        identitySealedAt: "2026-07-18T12:20:00.000Z",
        attestationVerifiedAt: "2026-07-18T12:25:00.000Z",
        worldReadyAt: "2026-07-18T12:30:00.000Z",
        indexerReadyAt: "2026-07-18T12:35:00.000Z",
      }),
    ).toBe("provisioning-indexer");
    expect(
      deriveGameStackOperationalPhase("Attested", {
        identitySealedAt: "2026-07-18T12:20:00.000Z",
        attestationVerifiedAt: "2026-07-18T12:25:00.000Z",
        worldReadyAt: "2026-07-18T12:30:00.000Z",
        indexerReadyAt: "2026-07-18T12:35:00.000Z",
        registryVerifiedAt: "2026-07-18T12:40:00.000Z",
      }),
    ).toBe("ready");
    expect(deriveGameStackOperationalPhase("Active")).toBe("active");
    expect(deriveGameStackOperationalPhase("FinalRootsSealed")).toBe("settling");
    expect(deriveGameStackOperationalPhase("Retired")).toBe("closed");
    expect(deriveGameStackOperationalPhase("ProvisioningAborted")).toBe("failed");
  });
  test("assigns the next whole-hour window with the production readiness margin", () => {
    const quote = createBlitzLaunchQuote({
      quoteId: "quote-42",
      requesterWallet: "0x1234",
      presetId: "blitz-open",
      now: new Date("2026-07-18T10:17:12.000Z"),
    });

    expect(quote).toEqual({
      schemaVersion: 1,
      quoteId: "quote-42",
      requesterWallet: "0x1234",
      presetId: "blitz-open",
      durationSeconds: 5_400,
      twoPlayerMode: false,
      intendedStart: "2026-07-18T13:00:00.000Z",
      intendedEnd: "2026-07-18T14:30:00.000Z",
      readinessDeadline: "2026-07-18T12:45:00.000Z",
      expiresAt: "2026-07-18T10:47:12.000Z",
    });
  });

  test("derives the duel configuration from the approved preset instead of request overrides", () => {
    const quote = createBlitzLaunchQuote({
      quoteId: "quote-duel",
      requesterWallet: "0xabcd",
      presetId: "blitz-duel",
      now: new Date("2026-07-18T10:00:00.000Z"),
    });

    expect(quote.durationSeconds).toBe(5_400);
    expect(quote.twoPlayerMode).toBe(true);
  });

  test("rejects non-production and unknown presets", () => {
    expect(() =>
      createBlitzLaunchQuote({
        quoteId: "quote-sandbox",
        requesterWallet: "0x1234",
        presetId: "blitz-sandbox",
        now: new Date("2026-07-18T10:00:00.000Z"),
      }),
    ).toThrow('Blitz preset "blitz-sandbox" is not approved for public production launches');
  });
});
