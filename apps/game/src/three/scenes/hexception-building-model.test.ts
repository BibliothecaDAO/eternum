import { describe, expect, it } from "vitest";
import { BUILDINGS_CENTER, BuildingType, RealmLevels, StructureType } from "@bibliothecadao/types";
import { buildingModelPaths, BUILDINGS_GROUPS, castleLevelToRealmCastle } from "../constants/scene-constants";
import { realmBuildingKitPath } from "../structures/realm-building-kit";
import { aspectWonderKitPath } from "../structures/realm-kit";
import { getBuildingDisplayName, resolveBuildingModelSelection } from "./hexception-building-model";

const context = {
  stage: RealmLevels.Settlement,
  mainStructureType: StructureType.Realm,
  wonder: false,
};
const labor = { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], tier: 1 };
const keep = { ...labor, col: BUILDINGS_CENTER[0], structureType: StructureType.Realm };

function modelPath(building: typeof labor, stage = RealmLevels.Settlement) {
  const selected = resolveBuildingModelSelection(building, { ...context, stage });
  const paths = buildingModelPaths()[selected.group] as Record<string, string>;
  return selected.tierPath ?? paths[selected.type];
}

describe("Workshops and central keeps share Labor but keep their own identity", () => {
  it.each([RealmLevels.Settlement, RealmLevels.City, RealmLevels.Kingdom, RealmLevels.Empire])(
    "draws the production Workshop outside the center at realm level %s",
    (stage) => {
      expect(modelPath(labor, stage)).toBe("/models/new-buildings-opt/workshop.glb");
      expect(getBuildingDisplayName(labor, stage, "Village", false)).toBe("Workshop");
      for (const tier of [2, 3])
        expect(modelPath({ ...labor, tier }, stage)).toBe(realmBuildingKitPath("workshop", tier));
    },
  );

  it.each([RealmLevels.Settlement, RealmLevels.City, RealmLevels.Kingdom, RealmLevels.Empire])(
    "keeps the center's actual castle and name at realm level %s",
    (stage) => {
      const name = castleLevelToRealmCastle[stage];
      expect(modelPath(keep, stage)).toBe(buildingModelPaths()[BUILDINGS_GROUPS.REALMS][name]);
      expect(getBuildingDisplayName(keep, stage, "Village", false)).toBe(name);
    },
  );

  it.each([StructureType.Village, StructureType.Camp])("keeps outpost %s in the center only", (mainStructureType) => {
    const center = { ...keep, structureType: mainStructureType };
    expect(resolveBuildingModelSelection(center, { ...context, mainStructureType })).toEqual({
      group: BUILDINGS_GROUPS.VILLAGE,
      type: mainStructureType,
      tierPath: undefined,
    });
    expect(getBuildingDisplayName(center, context.stage, "Outpost", false)).toBe("Outpost");
    expect(resolveBuildingModelSelection(labor, { ...context, mainStructureType })).toEqual({
      group: BUILDINGS_GROUPS.BUILDINGS,
      type: BuildingType.ResourceLabor,
      tierPath: undefined,
    });
  });

  it("keeps a wonder confined to the central keep and falls back to base without an Aspect", () => {
    const aligned = resolveBuildingModelSelection(keep, { ...context, wonder: true, frontier: true, aspect: 1 });
    expect(aligned.group).toBe(BUILDINGS_GROUPS.REALMS);
    expect(aligned.tierPath).toBe(aspectWonderKitPath(1, RealmLevels.Settlement));
    expect(
      resolveBuildingModelSelection(labor, { ...context, wonder: true, frontier: true, aspect: 1 }).tierPath,
    ).toBeUndefined();
    expect(resolveBuildingModelSelection(keep, { ...context, wonder: true }).tierPath).toBeUndefined();
  });
});
