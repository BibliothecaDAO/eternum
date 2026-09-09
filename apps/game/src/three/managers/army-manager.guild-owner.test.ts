// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
const membership = vi.hoisted(() => ({ allied: false }));
vi.mock("@/utils/entity-ownership", () => ({ arePlayersAllied: () => membership.allied }));
import { ArmyManager } from "./army-manager";

it("recolours tracked ships immediately on a guild change without an army update", () => {
  let emit!: () => void;
  const unsubscribe = vi.fn();
  const army = { isMine: false, isDaydreamsAgent: false, owner: { address: 123n }, color: "#ef4444" };
  const label = { color: army.color };
  const manager = Object.assign(Object.create(ArmyManager.prototype), {
    components: {
      GuildMember: {
        update$: {
          subscribe: (callback: () => void) => {
            emit = callback;
            return { unsubscribe };
          },
        },
      },
    },
    armyPresentations: new Map([[1, army]]),
    entityIdLabels: new Map([[1, label]]),
    visibleArmyIndices: new Map(),
    updateArmyLabelData: (_id: number, value: typeof army, target: typeof label) => {
      target.color = value.color;
    },
  });
  manager.subscribeToGuildMembership();
  membership.allied = true;
  emit();
  expect(army.color).toBe("#60a5fa");
  expect(label.color).toBe("#60a5fa");
  membership.allied = false;
  emit();
  expect(army.color).toBe("#ef4444");
  manager.unsubscribeGuildMembership();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
