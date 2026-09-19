import { describe, expect, it, vi } from "vitest";
import { DISPLAYED_SLOT_NUMBER_MAP, GuardSlot, StructureType } from "@bibliothecadao/types";
import { SLOT_ICON_MAP } from "../components/slot-icon-map";
import { getStructureDefenseSlotLimit, getUnlockedGuardSlots } from "./defense-slot-utils";

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: { getWorldStructureDefenseSlotsConfig: () => ({}) },
}));

describe("native guard slots", () => {
  it("uses the contract slot identities", () => {
    expect([GuardSlot.Delta, GuardSlot.Gamma, GuardSlot.Beta, GuardSlot.Alpha]).toEqual([0, 1, 2, 3]);
  });

  it.each([
    [0, [0]],
    [1, [0, 1]],
    [2, [0, 1, 2]],
    [3, [0, 1, 2, 3]],
  ] as const)("unlocks the same prefix for a level %i realm or village", (level, expected) => {
    for (const category of [StructureType.Realm, StructureType.Village]) {
      const slots = getUnlockedGuardSlots(getStructureDefenseSlotLimit(category, level));
      expect(slots).toEqual(expected);
      for (const slot of slots) {
        const displayed = [1, 2, 3, 4][slot];
        expect(DISPLAYED_SLOT_NUMBER_MAP[slot as GuardSlot]).toBe(displayed);
        expect(SLOT_ICON_MAP[slot]).toBe(`/image-icons/slots/slot${displayed}.png`);
      }
      expect(slots).not.toContain(level + 1);
    }
  });
});
