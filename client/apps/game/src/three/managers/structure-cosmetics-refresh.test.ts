import { describe, expect, it, vi } from "vitest";

import { normalizeStructureCosmeticOwner, refreshStructureCosmeticsByOwner } from "./structure-cosmetics-refresh";

describe("structure cosmetics refresh", () => {
  it("normalizes bigint and prefixed owner ids for cosmetics refresh", () => {
    expect(normalizeStructureCosmeticOwner(255n)).toBe("0xff");
    expect(normalizeStructureCosmeticOwner("0XABCD")).toBe("0xabcd");
    expect(normalizeStructureCosmeticOwner("raw-owner")).toBe("raw-owner");
  });

  it("refreshes only matching owner structures and reports whether a visible structure changed", () => {
    const visibleStructure = {
      owner: { address: 0xabcden },
      structureType: "Village",
      stage: 1,
      hexCoords: { col: 1, row: 2 },
    } as any;
    const hiddenStructure = {
      owner: { address: 0xabcden },
      structureType: "Realm",
      stage: 2,
      hexCoords: { col: 9, row: 9 },
    } as any;
    const otherOwnerStructure = {
      owner: { address: 0x1234n },
      structureType: "Village",
      stage: 1,
      hexCoords: { col: 5, row: 6 },
    } as any;
    const resolveCosmetic = vi.fn((structure: any) => ({
      skin: {
        cosmeticId: `${structure.structureType}-skin`,
        assetPaths: [`${structure.structureType}.glb`],
        isFallback: false,
      },
      attachments: [{ slot: "banner" }],
    }));

    const shouldRefreshVisibleStructures = refreshStructureCosmeticsByOwner({
      owner: "0xabCDe",
      structuresByType: new Map([
        [
          "Village",
          new Map([
            [1, visibleStructure],
            [2, otherOwnerStructure],
          ]),
        ],
        ["Realm", new Map([[3, hiddenStructure]])],
      ]),
      resolveCosmetic,
      isVisible: (hexCoords) => hexCoords.col === 1,
    });

    expect(resolveCosmetic).toHaveBeenCalledTimes(2);
    expect(visibleStructure.cosmeticId).toBe("Village-skin");
    expect(hiddenStructure.cosmeticId).toBe("Realm-skin");
    expect(otherOwnerStructure.cosmeticId).toBeUndefined();
    expect(shouldRefreshVisibleStructures).toBe(true);
  });
});
