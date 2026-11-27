import { describe, expect, it } from "vitest";
import { REALM_ASSETS, REALM_PATHS, realmModelIndex, isWonderModelPath } from "./realm-design";
import { SEASON_ONE_REALM_KIT_LEVELS, aspectWonderKitPath } from "./realm-kit";
import { getStructureModelPaths, isRealmModelPath, isSettlementModelPath } from "../constants/scene-constants";
import { aspects, rankName, RealmLevels, StructureType } from "@bibliothecadao/types";

describe("picked realm series", () => {
  it("keeps the chain's zero-based level mapping and falls back to base realms when a wonder has no Aspect", () => {
    expect(getStructureModelPaths()[StructureType.Realm]).toEqual(REALM_PATHS);
    for (const level of [0, 1, 2, 3]) {
      expect(realmModelIndex(level, false)).toBe(level);
      expect(realmModelIndex(level, true)).toBe(level);
      expect(realmModelIndex(level, true, null)).toBe(level);
      const base = REALM_ASSETS[level];
      expect(base.level).toBe(level);
      expect(base.wonder).toBe(false);
      expect(isWonderModelPath(base.path)).toBe(false);
      expect(isRealmModelPath(base.path) && isSettlementModelPath(base.path)).toBe(true);
    }
    for (const level of [-1, 4, 1.5, NaN]) expect(() => realmModelIndex(level, false)).toThrow();
  });

  it("maps every catalog Aspect to its procedural Wonder kit across all four realm levels with no unaligned Wonder", () => {
    const seenIds = new Set<string>();
    for (const { id: aspect, name } of aspects) {
      for (const level of SEASON_ONE_REALM_KIT_LEVELS) {
        const kitIndex = realmModelIndex(level, true, aspect);
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
    expect(REALM_ASSETS.filter((asset) => asset.wonder && asset.aspect === undefined)).toEqual([]);

    for (const level of [RealmLevels.Settlement, RealmLevels.City, RealmLevels.Kingdom, RealmLevels.Empire]) {
      const unaligned = REALM_ASSETS[realmModelIndex(level, true, null)];
      expect(unaligned.wonder).toBe(false);
      expect(unaligned.level).toBe(level);
    }
  });
});
