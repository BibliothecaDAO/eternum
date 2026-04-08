import { describe, expect, it, vi } from "vitest";

import { normalizeArmyCosmeticOwner, refreshVisibleArmyCosmeticsByOwner } from "./army-cosmetics-refresh";

describe("army cosmetics refresh", () => {
  it("normalizes bigint and prefixed owner ids", () => {
    expect(normalizeArmyCosmeticOwner(255n)).toBe("0xff");
    expect(normalizeArmyCosmeticOwner("0XABCD")).toBe("0xabcd");
    expect(normalizeArmyCosmeticOwner("raw-owner")).toBe("raw-owner");
  });

  it("refreshes only visible armies owned by the requested owner", () => {
    const refreshArmyInstance = vi.fn();
    const getAssignedModelType = vi.fn((entityId: number) => (entityId === 7 ? "knight" : undefined));
    const visibleArmyIndices = new Map([
      [7, 2],
      [8, 3],
    ]);
    const armies = new Map([
      [7, { entityId: 7, owner: { address: 0xabcden } }],
      [8, { entityId: 8, owner: { address: 0x1234n } }],
      [9, { entityId: 9, owner: { address: 0xabcden } }],
    ]);

    const updatedArmyIds = refreshVisibleArmyCosmeticsByOwner({
      owner: "0xabCDe",
      armies,
      visibleArmyIndices,
      getAssignedModelType,
      toNumericId: (entityId) => Number(entityId),
      refreshArmyInstance,
    });

    expect(refreshArmyInstance).toHaveBeenCalledTimes(1);
    expect(refreshArmyInstance).toHaveBeenCalledWith({ entityId: 7, owner: { address: 0xabcden } }, 2, "knight", true);
    expect(updatedArmyIds).toEqual([7]);
  });
});
