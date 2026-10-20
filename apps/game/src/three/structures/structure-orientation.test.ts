import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { resolveStructureRotationY } from "./structure-orientation";
import { FALLEN_REALM_RUIN_PATH, FRONTIER_BEASTS } from "./frontier-beast";
import {
  BUILDINGS_GROUPS,
  buildingModelPaths,
  CAMP_MODEL_PATH,
  CLEARED_SITE_MODEL_PATH,
  getStructureModelPaths,
  REALM_MODEL_PATHS,
  RiftModelPath,
  VILLAGE_MODEL_PATH,
} from "../constants/scene-constants";

import { formatStructureCosmeticTarget, getCosmeticRegistry } from "../cosmetics/registry";

const catalog = getStructureModelPaths();
const realmTarget = formatStructureCosmeticTarget(StructureType.Realm);
const realmSkins = getCosmeticRegistry().filter(
  (entry) =>
    entry.category === "structure-skin" &&
    entry.appliesTo.some((target) => target === realmTarget || target.startsWith(`${realmTarget}:`)),
);

describe("orientation follows the models drawn", () => {
  it.each([...Object.values(REALM_MODEL_PATHS), VILLAGE_MODEL_PATH, CAMP_MODEL_PATH])(
    "faces settlement %s toward the camera for every tile rotation and local template offset",
    (path) => {
      for (let direction = 0; direction < 6; direction++) {
        for (const templateOffset of [0, Math.PI]) {
          expect(resolveStructureRotationY([path], (direction * Math.PI) / 3 + templateOffset)).toBe(0);
        }
      }
    },
  );

  it.each([StructureType.Camp, StructureType.Rift, StructureType.Ruin, StructureType.Beasts])(
    "faces the cleared standard identically after category %s, without a standing beast",
    (category) => {
      const clearedPath = catalog[category].at(-1)!;
      expect(clearedPath).toBe(CLEARED_SITE_MODEL_PATH);
      for (let direction = 0; direction < 6; direction++) {
        expect(resolveStructureRotationY([clearedPath], (direction * Math.PI) / 3)).toBe(0);
      }
    },
  );

  it.each(Object.entries(FRONTIER_BEASTS))(
    "faces %s toward the camera alone or with either landmark at every tile rotation",
    (_, { path }) => {
      for (const paths of [[path], [FALLEN_REALM_RUIN_PATH, path], [RiftModelPath, path]]) {
        for (let direction = 0; direction < 6; direction++) {
          expect(resolveStructureRotationY(paths, (direction * Math.PI) / 3)).toBe(0);
        }
      }
    },
  );

  it.each([
    catalog[StructureType.Bank][0],
    catalog[StructureType.Hyperstructure][0],
    catalog[StructureType.Mine][0],
    FALLEN_REALM_RUIN_PATH,
    RiftModelPath,
  ])("preserves the existing rotation for %s without a facing model", (path) => {
    expect(resolveStructureRotationY([path], 1.25)).toBe(1.25);
  });
});

describe("cosmetic skins inherit the facing of their model family", () => {
  it("covers both collection realm skins through the registry", () => {
    expect(realmSkins.flatMap((skin) => skin.ownershipKeys ?? [])).toEqual(
      expect.arrayContaining(["0x3040101", "0x3030501"]),
    );
  });

  it.each(realmSkins)("faces registered realm skin $id at every tile heading", (skin) => {
    for (let direction = 0; direction < 6; direction++) {
      expect(resolveStructureRotationY(skin.assetPaths, (direction * Math.PI) / 3)).toBe(0);
    }
  });

  it.each([true, false])("faces every local settlement model in mode blitz=%s", (blitz) => {
    const paths = buildingModelPaths(blitz);
    for (const group of [BUILDINGS_GROUPS.REALMS, BUILDINGS_GROUPS.VILLAGE]) {
      for (const path of Object.values(paths[group])) {
        expect(resolveStructureRotationY([path], 1.25)).toBe(0);
      }
    }
  });

  it("does not give standalone attachments the facing of the realm they attach to", () => {
    const attachments = getCosmeticRegistry().filter(
      (entry) => entry.category === "attachment" && entry.appliesTo.includes(realmTarget),
    );
    expect(attachments.length).toBeGreaterThan(0);
    for (const attachment of attachments) {
      expect(resolveStructureRotationY(attachment.assetPaths, 1.25)).toBe(1.25);
    }
  });
});
