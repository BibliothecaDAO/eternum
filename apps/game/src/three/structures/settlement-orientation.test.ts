import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { resolveSettlementRotationY } from "./settlement-orientation";

describe("settlement orientation", () => {
  it.each([StructureType.Realm, StructureType.Village, StructureType.Camp])(
    "faces category %s south for every tile rotation and local template offset",
    (category) => {
      for (let direction = 0; direction < 6; direction++) {
        for (const templateOffset of [0, Math.PI]) {
          expect(resolveSettlementRotationY(category, (direction * Math.PI) / 3 + templateOffset)).toBe(0);
        }
      }
    },
  );

  it.each([undefined, StructureType.Bank, StructureType.Hyperstructure, StructureType.HolySite])(
    "preserves the existing rotation for non-settlement category %s",
    (category) => {
      expect(resolveSettlementRotationY(category, 1.25)).toBe(1.25);
    },
  );
});
