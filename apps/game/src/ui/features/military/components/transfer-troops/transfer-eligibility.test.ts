// @vitest-environment node

import { describe, expect, it } from "vitest";
import { TransferDirection } from "./transfer-direction";
import { acceptsTroops, BALANCE_TRANSFER_SLOT, getTroopTransferBlockReason } from "./transfer-eligibility";

describe("getTroopTransferBlockReason", () => {
  it("allows explorer-to-explorer transfers between armies of different realms", () => {
    expect(
      getTroopTransferBlockReason({
        transferDirection: TransferDirection.ExplorerToExplorer,
        selectedEntityId: 1,
        targetExplorerOwner: 202,
        guardSlot: null,
      }),
    ).toBeNull();
  });

  it.each([
    ["owner", 1n, null],
    ["ally", 2n, "Cannot reinforce: Explorer home and target must have the same owner"],
    ["stranger", 3n, "Cannot reinforce: Explorer home and target must have the same owner"],
  ])("checks target ownership for a %s reinforcement", (_relation, targetOwner, expected) => {
    expect(
      getTroopTransferBlockReason({
        transferDirection: TransferDirection.ExplorerToStructure,
        selectedEntityId: 1,
        sourceHomeOwner: 1n,
        targetOwner: targetOwner as bigint,
        guardSlot: 1,
      }),
    ).toBe(expected);
  });

  it("allows a guard to join an explorer from another realm", () => {
    expect(
      getTroopTransferBlockReason({
        transferDirection: TransferDirection.StructureToExplorer,
        selectedEntityId: 303,
        targetExplorerOwner: 404,
        guardSlot: 1,
      }),
    ).toBeNull();
  });

  it("draws structure balance only into the structure's own explorer", () => {
    const balanceTransfer = (targetExplorerOwner: number) =>
      getTroopTransferBlockReason({
        transferDirection: TransferDirection.StructureToExplorer,
        selectedEntityId: 303,
        targetExplorerOwner,
        guardSlot: BALANCE_TRANSFER_SLOT,
      });
    expect(balanceTransfer(303)).toBeNull();
    expect(balanceTransfer(404)).toBe("Cannot use structure balance: Explorer is not owned by this structure");
  });
});

describe("acceptsTroops", () => {
  const knights = { tier: "T1", category: "Knight", count: 19_144 };

  it.each([
    ["a slot with no troops", undefined],
    ["a slot holding zero, counted as a number", { tier: "T2", category: "Crossbowman", count: 0 }],
    ["an army holding zero, counted on chain", { tier: "T2", category: "Crossbowman", count: 0n }],
    ["a holder of the same tier and type", { tier: "T1", category: "Knight", count: 500n }],
  ])("lets troops join %s", (_holder, holder) => {
    expect(acceptsTroops(holder, knights)).toBe(true);
  });

  it.each([
    ["another type", { tier: "T1", category: "Paladin", count: 500 }],
    ["another tier", { tier: "T2", category: "Knight", count: 500n }],
  ])("refuses troops into a holder of %s", (_difference, holder) => {
    expect(acceptsTroops(holder, knights)).toBe(false);
  });
});
