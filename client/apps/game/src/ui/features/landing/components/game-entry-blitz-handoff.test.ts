import { describe, expect, it } from "vitest";

import { resolveGameEntryModalPhase, resolveBlitzSettlementPhase } from "./game-entry-phase";
import {
  applyDashboardRegistrationHint,
  deriveSettlementStatus,
  type SettlementSnapshot,
} from "./game-entry-settlement.utils";

const snapshot = (partial: Partial<SettlementSnapshot> = {}): SettlementSnapshot => ({
  registered: false,
  onceRegistered: false,
  hasSettledStructure: false,
  coordsCount: 0,
  settledCount: 0,
  ...partial,
});

const resolvePhaseFromSnapshot = ({
  snapshot,
  entryIntent,
  hasDashboardRegistrationEntry,
  isSettlementUnlocked,
}: {
  snapshot: SettlementSnapshot;
  entryIntent: "play" | "settle" | "spectate" | "forge";
  hasDashboardRegistrationEntry: boolean;
  isSettlementUnlocked: boolean;
}) => {
  const hintedSnapshot = applyDashboardRegistrationHint({
    snapshot,
    entryIntent,
    hasDashboardRegistrationEntry,
  });
  const status = deriveSettlementStatus(hintedSnapshot);

  return resolveGameEntryModalPhase({
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
    needsSettlement: status.needsSettlement,
    isBlitzSettlementUnlocked: isSettlementUnlocked,
  });
};

describe("resolveBlitzSettlementPhase", () => {
  it("maps settled players to ready", () => {
    expect(resolveBlitzSettlementPhase({ needsSettlement: false, isSettlementUnlocked: false })).toBe("ready");
  });
});

describe("blitz entry handoff", () => {
  it("holds dashboard-registered play entries in settlement-waiting before unlock", () => {
    expect(
      resolvePhaseFromSnapshot({
        snapshot: snapshot(),
        entryIntent: "play",
        hasDashboardRegistrationEntry: true,
        isSettlementUnlocked: false,
      }),
    ).toBe("settlement-waiting");
  });

  it("moves dashboard-registered play entries into settlement after unlock", () => {
    expect(
      resolvePhaseFromSnapshot({
        snapshot: snapshot(),
        entryIntent: "play",
        hasDashboardRegistrationEntry: true,
        isSettlementUnlocked: true,
      }),
    ).toBe("settlement");
  });

  it("keeps settled entries ready", () => {
    expect(
      resolvePhaseFromSnapshot({
        snapshot: snapshot({
          onceRegistered: true,
          hasSettledStructure: true,
          settledCount: 3,
        }),
        entryIntent: "play",
        hasDashboardRegistrationEntry: true,
        isSettlementUnlocked: true,
      }),
    ).toBe("ready");
  });
});
