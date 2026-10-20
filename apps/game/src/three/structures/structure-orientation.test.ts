import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { resolveStructureRotationY } from "./structure-orientation";
import { FRONTIER_BEASTS } from "./frontier-beast";

describe("settlement orientation", () => {
  it.each([StructureType.Realm, StructureType.Village, StructureType.Camp])(
    "faces category %s south for every tile rotation and local template offset",
    (category) => {
      for (let direction = 0; direction < 6; direction++) {
        for (const templateOffset of [0, Math.PI]) {
          expect(
            resolveStructureRotationY({ structureType: category }, (direction * Math.PI) / 3 + templateOffset),
          ).toBe(0);
        }
      }
    },
  );

  it.each([undefined, StructureType.Bank, StructureType.Hyperstructure])(
    "preserves the existing rotation for non-settlement category %s",
    (category) => {
      expect(resolveStructureRotationY({ structureType: category }, 1.25)).toBe(1.25);
    },
  );
});

describe("Frontier beast orientation", () => {
  it.each(Object.keys(FRONTIER_BEASTS) as (keyof typeof FRONTIER_BEASTS)[])(
    "faces %s toward the camera at every site and tile rotation",
    (beast) => {
      for (const structureType of [StructureType.Camp, StructureType.Rift, StructureType.Ruin, StructureType.Beasts]) {
        for (let direction = 0; direction < 6; direction++) {
          expect(
            resolveStructureRotationY({ structureType, frontierBeast: { beast } }, (direction * Math.PI) / 3),
          ).toBe(0);
        }
      }
    },
  );

  it.each([StructureType.Rift, StructureType.Ruin, StructureType.Beasts])(
    "retains the landmark's existing rotation without a standing beast on category %s",
    (structureType) => {
      expect(resolveStructureRotationY({ structureType }, Math.PI)).toBe(Math.PI);
    },
  );
});
