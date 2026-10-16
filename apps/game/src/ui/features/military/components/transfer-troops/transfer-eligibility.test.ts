// @vitest-environment node

import { describe, expect, it } from "vitest";
import { TransferDirection } from "./transfer-direction";
import { BALANCE_TRANSFER_SLOT, getTroopTransferBlockReason } from "./transfer-eligibility";

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
