import { describe, expect, it } from "vitest";
import { REALM_ASSETS, REALM_PATHS, realmModelIndex, isWonderModelPath } from "./realm-design";
import { getStructureModelPaths, isRealmModelPath, isSettlementModelPath } from "../constants/scene-constants";
import { StructureType } from "@bibliothecadao/types";

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
});
