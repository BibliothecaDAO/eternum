import { describe, expect, it } from "vitest";
import { REALM_ASSETS, REALM_PATHS, realmModelIndex, isWonderModelPath } from "./realm-design";
import { aspectWonderKitPath } from "./realm-kit";
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

  it("maps every catalog Aspect to its procedural Wonder kit at Settlement and its Aspect Wonder model at higher ranks", () => {
    const seenIds = new Set<string>();
    for (const { id: aspect, name } of aspects) {
      const settlementIndex = realmModelIndex(RealmLevels.Settlement, true, 1003, aspect);
      const settlementAsset = REALM_ASSETS[settlementIndex];
      expect(settlementAsset.wonder).toBe(true);
      expect(settlementAsset.aspect).toBe(aspect);
      expect(settlementAsset.level).toBe(RealmLevels.Settlement);
      expect(settlementAsset.id).toBe(`wonder-${name.toLowerCase()}-0`);
      expect(settlementAsset.label).toBe(`Aspect Wonder · ${name} · ${rankName(RealmLevels.Settlement)}`);
      expect(settlementAsset.path).toBe(aspectWonderKitPath(aspect, RealmLevels.Settlement));
      expect(isWonderModelPath(settlementAsset.path)).toBe(true);
      expect(isRealmModelPath(settlementAsset.path) && isSettlementModelPath(settlementAsset.path)).toBe(true);

      const higherIndex = realmModelIndex(RealmLevels.City, true, 1003, aspect);
      const higherAsset = REALM_ASSETS[higherIndex];
      expect(higherAsset.wonder).toBe(true);
      expect(higherAsset.aspect).toBe(aspect);
      expect(higherAsset.id).toBe(`wonder-${name.toLowerCase()}`);
      expect(higherAsset.label).toBe(`Aspect Wonder · ${name}`);
      expect(isWonderModelPath(higherAsset.path)).toBe(true);
      expect(isRealmModelPath(higherAsset.path) && isSettlementModelPath(higherAsset.path)).toBe(true);
      for (const level of [RealmLevels.Kingdom, RealmLevels.Empire]) {
        expect(realmModelIndex(level, true, 1003, aspect)).toBe(higherIndex);
      }
      seenIds.add(settlementAsset.id);
    }
    expect(seenIds.size).toBe(aspects.length);

    expect(REALM_ASSETS[realmModelIndex(RealmLevels.Settlement, true, 1003, null)].id).toBe("standing-stones");
  });
});
