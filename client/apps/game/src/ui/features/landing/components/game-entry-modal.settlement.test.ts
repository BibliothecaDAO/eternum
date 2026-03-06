import { describe, expect, it, vi } from "vitest";

import { buildSettlementOperations, runSettlementOperations } from "./game-entry-modal.settlement";

describe("game-entry-modal settlement helpers", () => {
  it("resumes mainnet settlement from remaining assigned realms", () => {
    expect(
      buildSettlementOperations({
        isMainnet: true,
        singleRealmMode: false,
        assignedRealmCount: 3,
        settledRealmCount: 1,
      }),
    ).toEqual([
      { kind: "settle", settlementCount: 1 },
      { kind: "settle", settlementCount: 1 },
    ]);
  });

  it("plans only the missing assignment when mainnet has no pending assigned realms", () => {
    expect(
      buildSettlementOperations({
        isMainnet: true,
        singleRealmMode: false,
        assignedRealmCount: 2,
        settledRealmCount: 2,
      }),
    ).toEqual([{ kind: "assign-and-settle", settlementCount: 1 }]);
  });

  it("uses only missing count for non-mainnet assign-and-settle", () => {
    expect(
      buildSettlementOperations({
        isMainnet: false,
        singleRealmMode: false,
        assignedRealmCount: 1,
        settledRealmCount: 1,
      }),
    ).toEqual([{ kind: "assign-and-settle", settlementCount: 2 }]);
  });

  it("continues later settlement calls after an intermediate failure", async () => {
    const assignAndSettle = vi.fn().mockResolvedValue(undefined);
    const settleRealms = vi.fn().mockRejectedValueOnce(new Error("submission failed")).mockResolvedValueOnce(undefined);

    const result = await runSettlementOperations({
      signer: { address: "0x123" },
      operations: [
        { kind: "assign-and-settle", settlementCount: 1 },
        { kind: "settle", settlementCount: 1 },
        { kind: "settle", settlementCount: 1 },
      ],
      systemCalls: {
        blitz_realm_assign_and_settle_realms: assignAndSettle,
        blitz_realm_settle_realms: settleRealms,
      },
    });

    expect(assignAndSettle).toHaveBeenCalledTimes(1);
    expect(settleRealms).toHaveBeenCalledTimes(2);
    expect(result.successfulSettlementCount).toBe(2);
    expect(result.failures).toHaveLength(1);
  });
});
