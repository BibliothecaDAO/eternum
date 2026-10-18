import { describe, expect, it } from "vitest";
import { BUILDINGS_CENTER, BuildingType, RealmLevels, StructureType } from "@bibliothecadao/types";
import { buildingModelPaths, BUILDINGS_GROUPS, castleLevelToRealmCastle } from "../constants/scene-constants";
import { getBuildingDisplayName, resolveBuildingModelSelection } from "./hexception-building-model";

const context = {
  stage: RealmLevels.Settlement,
  structureId: 17,
  mainStructureType: StructureType.Realm,
  wonder: false,
};
const labor = { category: BuildingType.ResourceLabor, col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1], tier: 1 };
const keep = { ...labor, col: BUILDINGS_CENTER[0], structureType: StructureType.Realm };

function modelPath(building: typeof labor, stage = RealmLevels.Settlement) {
  const selected = resolveBuildingModelSelection(building, { ...context, stage });
  const paths = buildingModelPaths(false)[selected.group] as Record<string, string>;
  return selected.tierPath ?? paths[selected.type];
}

describe("Workshops and central keeps share Labor but keep their own identity", () => {
  it.each([RealmLevels.Settlement, RealmLevels.City, RealmLevels.Kingdom, RealmLevels.Empire])(
    "draws the production Workshop outside the center at realm level %s",
    (stage) => {
      expect(modelPath(labor, stage)).toBe("/models/new-buildings-opt/workshop.glb");
      expect(getBuildingDisplayName(labor, stage, "Village")).toBe("Workshop");
      for (const tier of [2, 3])
        expect(modelPath({ ...labor, tier }, stage)).toBe("/models/new-buildings-opt/workshop.glb");
    },
  );

  it.each([RealmLevels.Settlement, RealmLevels.City, RealmLevels.Kingdom, RealmLevels.Empire])(
    "keeps the center's actual castle and name at realm level %s",
    (stage) => {
      const name = castleLevelToRealmCastle[stage];
      expect(modelPath(keep, stage)).toBe(buildingModelPaths(false)[BUILDINGS_GROUPS.REALMS][name]);
      expect(getBuildingDisplayName(keep, stage, "Village")).toBe(name);
    },
  );

  it.each([StructureType.Village, StructureType.Camp])("keeps outpost %s in the center only", (mainStructureType) => {
    const center = { ...keep, structureType: mainStructureType };
    expect(resolveBuildingModelSelection(center, { ...context, mainStructureType })).toEqual({
      group: BUILDINGS_GROUPS.VILLAGE,
      type: mainStructureType,
      tierPath: undefined,
    });
    expect(getBuildingDisplayName(center, context.stage, "Outpost")).toBe("Outpost");
    expect(resolveBuildingModelSelection(labor, { ...context, mainStructureType })).toEqual({
      group: BUILDINGS_GROUPS.BUILDINGS,
      type: BuildingType.ResourceLabor,
      tierPath: undefined,
    });
  });

  it("keeps a wonder confined to the central keep", () => {
    const selected = resolveBuildingModelSelection(keep, { ...context, wonder: true });
    expect(selected.group).toBe(BUILDINGS_GROUPS.REALMS);
    expect(selected.tierPath).toBe("/models/realms/standing-stones.glb");
    expect(resolveBuildingModelSelection(labor, { ...context, wonder: true }).tierPath).toBeUndefined();
  });
});
