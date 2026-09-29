// @vitest-environment node

import { describe, expect, it } from "vitest";
import { TransferDirection } from "./transfer-direction";
import { BALANCE_TRANSFER_SLOT, getTroopTransferBlockReason } from "./transfer-eligibility";

describe("getTroopTransferBlockReason", () => {
  it("allows explorer-to-explorer transfers when both explorers belong to the same structure", () => {
    expect(
      getTroopTransferBlockReason({
        transferDirection: TransferDirection.ExplorerToExplorer,
        selectedEntityId: 1,
        targetEntityId: 2,
        selectedExplorerOwner: 101,
        targetExplorerOwner: 101,
        guardSlot: null,
      }),
    ).toBeNull();
  });

  it("blocks explorer-to-explorer transfers when explorers belong to different structures", () => {
    expect(
      getTroopTransferBlockReason({
        transferDirection: TransferDirection.ExplorerToExplorer,
        selectedEntityId: 1,
        targetEntityId: 2,
        selectedExplorerOwner: 101,
        targetExplorerOwner: 202,
        guardSlot: null,
      }),
    ).toBe("Cannot transfer troops: Both explorers must belong to the same structure");
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
        targetEntityId: 202,
        selectedExplorerOwner: 101,
        sourceHomeOwner: 1n,
        targetOwner: targetOwner as bigint,
        guardSlot: 1,
      }),
    ).toBe(expected);
  });

  it("allows structure-to-explorer guard transfers when the explorer belongs to the selected structure", () => {
    expect(
      getTroopTransferBlockReason({
        transferDirection: TransferDirection.StructureToExplorer,
        selectedEntityId: 303,
        targetEntityId: 2,
        selectedExplorerOwner: 0,
        targetExplorerOwner: 303,
        guardSlot: 1,
      }),
    ).toBeNull();
  });

  it("blocks structure-to-explorer guard transfers when the explorer belongs to a different structure", () => {
    expect(
      getTroopTransferBlockReason({
        transferDirection: TransferDirection.StructureToExplorer,
        selectedEntityId: 303,
        targetEntityId: 2,
        selectedExplorerOwner: 0,
        targetExplorerOwner: 404,
        guardSlot: 1,
      }),
    ).toBe("Cannot transfer troops: Explorer must belong to the selected structure");
  });

  it("keeps the existing balance-transfer ownership rule", () => {
    expect(
      getTroopTransferBlockReason({
        transferDirection: TransferDirection.StructureToExplorer,
        selectedEntityId: 303,
        targetEntityId: 2,
        selectedExplorerOwner: 0,
        targetExplorerOwner: 404,
        guardSlot: BALANCE_TRANSFER_SLOT,
      }),
    ).toBe("Cannot use structure balance: Explorer is not owned by this structure");
  });
});
