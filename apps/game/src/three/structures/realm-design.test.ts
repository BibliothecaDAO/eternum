import { describe, expect, it } from "vitest";
import { REALM_ASSETS, REALM_PATHS, realmModelIndex, isWonderModelPath } from "./realm-design";
import { SEASON_ONE_REALM_KIT_LEVELS, aspectWonderKitPath } from "./realm-kit";
import { getStructureModelPaths, isRealmModelPath, isSettlementModelPath } from "../constants/scene-constants";
import { aspects, rankName, RealmLevels, StructureType } from "@bibliothecadao/types";

describe("picked realm series", () => {
  it("keeps the chain's zero-based level mapping and gives every wonder its own realm body", () => {
    expect(getStructureModelPaths()[StructureType.Realm]).toEqual(REALM_PATHS);
    for (const level of [0, 1, 2, 3]) {
      expect(realmModelIndex(level, false, 1003)).toBe(level);
      const picked = new Set<string>();
      for (let id = 1; id <= 1000; id++) {
        const asset = REALM_ASSETS[realmModelIndex(level, true, id)];
        expect(asset.level).toBe(level);
        expect(asset.wonder).toBe(true);
        expect(isWonderModelPath(asset.path)).toBe(true);
        expect(isRealmModelPath(asset.path) && isSettlementModelPath(asset.path)).toBe(true);
        picked.add(asset.id);
      }
      expect(picked.size).toBe([1, 2, 2, 7][level]);
    }
    expect(REALM_ASSETS[realmModelIndex(2, true, 1003)].id).toBe("twin-guardians");
    expect(REALM_ASSETS[realmModelIndex(3, true, 1003)].id).toBe("sanctum-aureole");
  });
  it("preserves every entity ID digit and rejects invalid levels and IDs", () => {
    for (const level of [0, 1, 2, 3]) {
      expect(realmModelIndex(level, true, "18446744073709551615")).toBe(
        realmModelIndex(level, true, 18446744073709551615n),
      );
    }
    for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "01", "18446744073709551616"]) {
      expect(() => realmModelIndex(1, true, id)).toThrow();
    }
    for (const level of [-1, 4, 1.5, NaN]) expect(() => realmModelIndex(level, false, 1)).toThrow();
  });

  it("maps every catalog Aspect to its procedural Wonder kit across all four realm levels and preserves unaligned fallbacks", () => {
    const seenIds = new Set<string>();
    for (const { id: aspect, name } of aspects) {
      for (const level of SEASON_ONE_REALM_KIT_LEVELS) {
        const kitIndex = realmModelIndex(level, true, 1003, aspect);
        const kitAsset = REALM_ASSETS[kitIndex];
        expect(kitAsset.wonder).toBe(true);
        expect(kitAsset.aspect).toBe(aspect);
        expect(kitAsset.level).toBe(level);
        expect(kitAsset.id).toBe(`wonder-${name.toLowerCase()}-${level}`);
        expect(kitAsset.label).toBe(`Aspect Wonder · ${name} · ${rankName(level)}`);
        expect(kitAsset.path).toBe(aspectWonderKitPath(aspect, level));
        expect(isWonderModelPath(kitAsset.path)).toBe(true);
        expect(isRealmModelPath(kitAsset.path) && isSettlementModelPath(kitAsset.path)).toBe(true);
        seenIds.add(kitAsset.id);
      }
    }
    expect(seenIds.size).toBe(aspects.length * SEASON_ONE_REALM_KIT_LEVELS.length);

    const unalignedSettlement = REALM_ASSETS[realmModelIndex(RealmLevels.Settlement, true, 1003, null)];
    expect(unalignedSettlement.id).toBe("standing-stones");
    expect(unalignedSettlement.aspect).toBeUndefined();
    const unalignedCity = REALM_ASSETS[realmModelIndex(RealmLevels.City, true, 1003, null)];
    expect(unalignedCity.id).toBe("oath-arch");
    expect(unalignedCity.aspect).toBeUndefined();
    const unalignedKingdom = REALM_ASSETS[realmModelIndex(RealmLevels.Kingdom, true, 1003, null)];
    expect(unalignedKingdom.id).toBe("twin-guardians");
    expect(unalignedKingdom.aspect).toBeUndefined();
    const unalignedEmpire = REALM_ASSETS[realmModelIndex(RealmLevels.Empire, true, 1003, null)];
    expect(unalignedEmpire.id).toBe("sanctum-aureole");
    expect(unalignedEmpire.aspect).toBeUndefined();
  });
});
