// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
vi.mock("@/utils/utils", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAddressEqualToAccount: (address: bigint) => address === 222n,
}));
import { ArmyManager } from "./army-manager";

describe("army ownership dependencies", () => {
  it("updates all dependent owners and label colours synchronously without an army update", () => {
    const army = (structure: number) => ({
      owningStructureId: structure,
      owner: { address: 111n, ownerName: "Old", guildName: "Old guild" },
      isMine: false,
      color: "old",
    });
    const first = army(10),
      second = army(10),
      unrelated = army(20);
    let emit!: (update: { value: unknown[] }) => void;
    const unsubscribe = vi.fn();
    const labels = new Map([
      [1, { color: "old" }],
      [2, { color: "old" }],
    ]);
    const manager = Object.assign(Object.create(ArmyManager.prototype), {
      components: {
        Structure: {
          update$: {
            subscribe: (callback: typeof emit) => {
              emit = callback;
              return { unsubscribe };
            },
          },
        },
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
    emit({
      value: [
        { entity_id: 10, owner: 222n },
        { entity_id: 10, owner: 111n },
      ],
    });
    for (const dependent of [first, second]) {
      expect(dependent.owner).toEqual({ address: 222n, ownerName: "Owner 222", guildName: "" });
      expect(dependent.color).toBe("colour-222");
    }
    expect([...labels.values()].map((label) => label.color)).toEqual(["colour-222", "colour-222"]);
    expect(unrelated.owner.address).toBe(111n);
    expect(manager.updateArmyLabelData).toHaveBeenCalledTimes(2);
    emit({
      value: [
        { entity_id: 10, owner: 222n },
        { entity_id: 10, owner: 222n },
      ],
    });
    expect(manager.updateArmyLabelData).toHaveBeenCalledTimes(2);
    emit({
      value: [
        { entity_id: 10, owner: 0n },
        { entity_id: 10, owner: 222n },
      ],
    });
    expect(first.owner.address).toBe(0n);
    expect(labels.get(1)?.color).toBe("colour-0");
    manager.unsubscribeStructureOwnership();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
