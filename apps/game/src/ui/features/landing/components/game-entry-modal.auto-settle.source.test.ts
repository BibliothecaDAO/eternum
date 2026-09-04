// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Game entry modal auto-settle", () => {
  it("accepts auto-settle mode and starts settlement automatically once the Blitz settlement phase is ready", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/game-entry-modal.tsx"),
      "utf8",
    );

    expect(source).toContain("autoSettleEnabled?: boolean");
    expect(source).toContain('"settlement-waiting"');
    expect(source).toContain("resolveBlitzSettlementAvailability");
    expect(source).toContain("Settlement Opens Soon");
    expect(source).toContain('if (!autoSettleEnabled || phase !== "settlement"');
    expect(source).toContain("void handleSettle();");
    expect(source).toContain("buildBlitzSettleCalls({");
    expect(source).toContain("getExpectedBlitzSettlementCount(worldMeta?.singleRealmMode ?? false)");
    expect(source).not.toContain('const singleRealmMode = chain === "mainnet";');
    expect(source).toContain('operation: "blitz_realm_systems.settle"');
    expect(source).toContain('setSettleStage("syncing")');
    expect(source).toContain("waitForSettlementTarget(expectedBlitzSettlementCount)");
    expect(source).not.toContain("SETTLEMENT_PROGRESS_TIMEOUT_MS");
    expect(source).toContain("finalizeSuccessfulBlitzSettlement();");
    expect(source).toContain(
      'finalizeFailedBlitzSettlement(error instanceof Error ? error : new Error("Settlement failed"));',
    );
    expect(source).not.toContain("runBlitzSettlementFlow({");
    expect(source).not.toContain("assign_realm_positions");
    expect(source).not.toContain("settle_realms");
    expect(source).toContain("markCompleted(autoSettleEntryKey)");
    expect(source).toContain("markFailed(autoSettleEntryKey");
  });
});
