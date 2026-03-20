import { describe, expect, it } from "vitest";

import { resolveArmySlotCompactionPlan } from "./army-slot-compaction";

describe("resolveArmySlotCompactionPlan", () => {
  it("compacts sparse slots into a dense lower range without changing entity ownership", () => {
    expect(
      resolveArmySlotCompactionPlan([
        { entityId: 11, slot: 5 },
        { entityId: 7, slot: 0 },
        { entityId: 9, slot: 3 },
      ]),
    ).toEqual({
      needsCompaction: true,
      reassignments: [
        { entityId: 9, fromSlot: 3, toSlot: 1 },
        { entityId: 11, fromSlot: 5, toSlot: 2 },
      ],
    });
  });

  it("does nothing when the slots are already dense", () => {
    expect(
      resolveArmySlotCompactionPlan([
        { entityId: 1, slot: 0 },
        { entityId: 2, slot: 1 },
      ]),
    ).toEqual({
      needsCompaction: false,
      reassignments: [],
    });
  });
});
