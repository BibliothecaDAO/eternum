// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
vi.mock("@/utils/utils", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAddressEqualToAccount: (address: bigint) => address === 222n,
}));
import { configManager } from "@bibliothecadao/eternum";
import { ArmyManager } from "./army-manager";

describe("army ownership dependencies", () => {
  it("updates all dependent owners and label colours synchronously without an army update", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    let currentOwner = 111n;
    const army = (structure: number) => ({
      owningStructureId: structure,
      owner: { address: 111n, ownerName: "Old", guildName: "Old guild" },
      isMine: false,
      color: "old",
    });
    const first = army(10),
      second = army(10),
      unrelated = army(20);
    let emit!: (changes: unknown[]) => void;
    const unsubscribe = vi.fn();
    const labels = new Map([
      [1, { color: "old" }],
      [2, { color: "old" }],
    ]);
    const manager = Object.assign(Object.create(ArmyManager.prototype), {
      store: {
        subscribe: (callback: typeof emit) => {
          emit = callback;
          return unsubscribe;
        },
        require: (model: string) => {
          if (model !== "Structure") throw new Error(`Unexpected required model ${model}`);
          return { owner: currentOwner };
        },
        get: (model: string, keys: { explorer_id?: number }) =>
          model === "ExplorerTroops"
            ? { game_id: 1, explorer_id: keys.explorer_id, owner: keys.explorer_id === 3 ? 20 : 10 }
            : model === "Structure"
              ? { owner: currentOwner }
              : undefined,
      },
      armyPresentations: new Map([
        [1, first],
        [2, second],
        [3, unrelated],
      ]),
      entityIdLabels: labels,
      visibleArmyIndices: new Map(),
      resolveArmyOwnerNameForAddress: (address: bigint) => `Owner ${address}`,
      getArmyColor: ({ owner }: { owner: { address: bigint } }) => `colour-${owner.address}`,
      updateArmyLabelData: vi.fn((_id, data, label) => {
        label.color = data.color;
      }),
    });
    manager.subscribeToStructureOwnership();
    currentOwner = 222n;
    emit([
      {
        model: "Structure",
        current: { game_id: 1, entity_id: 10, owner: 222n },
        previous: { game_id: 1, entity_id: 10, owner: 111n },
      },
    ]);
    for (const dependent of [first, second]) {
      expect(dependent.owner).toEqual({ address: 222n, ownerName: "Owner 222", guildName: "" });
      expect(dependent.color).toBe("colour-222");
    }
    expect([...labels.values()].map((label) => label.color)).toEqual(["colour-222", "colour-222"]);
    expect(unrelated.owner.address).toBe(111n);
    expect(manager.updateArmyLabelData).toHaveBeenCalledTimes(2);
    currentOwner = 222n;
    emit([
      {
        model: "Structure",
        current: { game_id: 1, entity_id: 10, owner: 222n },
        previous: { game_id: 1, entity_id: 10, owner: 222n },
      },
    ]);
    expect(manager.updateArmyLabelData).toHaveBeenCalledTimes(2);
    currentOwner = 0n;
    emit([
      {
        model: "Structure",
        current: { game_id: 1, entity_id: 10, owner: 0n },
        previous: { game_id: 1, entity_id: 10, owner: 222n },
      },
    ]);
    expect(first.owner.address).toBe(0n);
    expect(labels.get(1)?.color).toBe("colour-0");
    manager.unsubscribeStructureOwnership();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
