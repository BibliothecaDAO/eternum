import { describe, expect, it, vi } from "vitest";

import { StructureRecordStore } from "./structure-record-store";

describe("StructureRecordStore", () => {
  it("adds and retrieves structure records while resolving ownership", () => {
    const store = new StructureRecordStore({
      isAddressMine: (address) => address === 123n,
    });

    store.addStructure(
      7 as any,
      "Camp",
      "Village" as any,
      { col: 1, row: 2 },
      true,
      1,
      3,
      { address: 123n, ownerName: "Alice", guildName: "Guild" },
      false,
      [{ slot: "banner" }] as any,
      true,
    );

    expect(store.getStructureByEntityId(7 as any)).toMatchObject({
      entityId: 7,
      structureName: "Camp",
      isMine: true,
      isAlly: true,
      structureType: "Village",
    });
  });

  it("removes structures by position and calls lifecycle hooks", () => {
    const onRemove = vi.fn();
    const onStructuresChanged = vi.fn();
    const store = new StructureRecordStore({
      isAddressMine: () => false,
      onRemove,
      onStructuresChanged,
    });

    store.addStructure(
      7 as any,
      "Camp",
      "Village" as any,
      { col: 1, row: 2 },
      true,
      1,
      3,
      { address: 123n, ownerName: "Alice", guildName: "Guild" },
      false,
      undefined,
      false,
    );

    store.removeStructureFromPosition({ col: 1, row: 2 });

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onStructuresChanged).toHaveBeenCalledTimes(1);
    expect(store.getStructureByEntityId(7 as any)).toBeUndefined();
  });

  it("rechecks ownership across stored structures", () => {
    let mineAddress = 123n;
    const store = new StructureRecordStore({
      isAddressMine: (address) => address === mineAddress,
    });

    store.addStructure(
      7 as any,
      "Camp",
      "Village" as any,
      { col: 1, row: 2 },
      true,
      1,
      3,
      { address: 123n, ownerName: "Alice", guildName: "Guild" },
      false,
      undefined,
      false,
    );

    mineAddress = 456n;
    store.recheckOwnership();

    expect(store.getStructureByEntityId(7 as any)?.isMine).toBe(false);
  });
});
