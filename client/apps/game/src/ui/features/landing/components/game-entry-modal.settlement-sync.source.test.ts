// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameEntryModal settlement sync recovery", () => {
  it("submits landing settlement transactions without blocking on confirmation", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toMatch(/operation: "assign_and_settle_realms"[\s\S]*waitForConfirmation: false/);
    expect(source).toMatch(/operation: "settle_realms"[\s\S]*waitForConfirmation: false/);
    expect(source).toMatch(/operation: "season_realm_create"[\s\S]*waitForConfirmation: false/);
    expect(source).toMatch(/operation: "village_systems.create"[\s\S]*waitForConfirmation: false/);
    expect(source).toContain("confirm: async (txHash) => {");
  });

  it("polls indexed settlement state after submitted realm and village transactions", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("const waitForRealmSettlementIndex = useCallback");
    expect(source).toContain("findIndexedRealmSettlement");
    expect(source).toContain("findNewIndexedVillageSettlement");
    expect(source).toContain("Submitted but still syncing. Checking indexed world state.");
    expect(source).toContain('buildSettlementStillSyncingMessage("realm")');
    expect(source).toContain('buildSettlementStillSyncingMessage("village")');
  });

  it("refreshes settlement queries when the modal opens", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("const invalidateEternumSettlementQueries = useCallback");
    expect(source).toContain('queryKey: ["eternumOwnedStructures", chain, worldName, account?.address]');
    expect(source).toContain('queryKey: ["settlementPlannerSnapshot", chain, worldName]');
    expect(source).toContain("const refreshEternumSettlementQueries = useCallback");
    expect(source).toContain("refetchOwnedStructures()");
    expect(source).toContain("refetchRealmVillageSlots()");
    expect(source).toContain("refetchSettlementPlannerData()");
    expect(source).toContain("void refreshEternumSettlementQueries();");
  });

  it("keeps settlement buttons disabled while submitted transactions are being verified", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain(
      "disabled={!seasonTimingValid || selectedSeasonPassTokenId == null || isSubmittingRealmSettlement}",
    );
    expect(source).toContain(
      "disabled={!seasonTimingValid || selectedVillagePassTokenId == null || isSubmittingVillageSettlement}",
    );
    expect(source).toContain("selectedSeasonPassTokenId != null && canSettle");
    expect(source).toContain("!isSubmittingSettlement");
  });
});
