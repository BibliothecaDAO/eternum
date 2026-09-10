import { Position } from "@bibliothecadao/eternum";
import { StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import type { ArmyData, StructureInfo } from "../types";
import {
  resolveArmyCompactEntityLabel,
  resolveCompactEntityLabelVariant,
  resolveStructureCompactEntityLabel,
} from "./compact-entity-label-policy";

const baseArmy = {
  entityId: 101,
  hexCoords: new Position({ x: 1, y: 2 }),
  isMine: false,
  owningStructureId: null,
  owner: { address: 123n, ownerName: "Sable Order", guildName: "" },
  color: "#ffffff",
  category: TroopType.Knight,
  tier: TroopTier.T1,
  isDaydreamsAgent: false,
  troopCount: 12,
  currentStamina: 8,
  maxStamina: 10,
} satisfies ArmyData;

const baseStructure = {
  structureName: "North Camp",
  entityId: 202,
  hexCoords: { col: 3, row: 4 },
  stage: 1,
  initialized: true,
  level: 1,
  isMine: false,
  isAlly: false,
  owner: { address: 456n, ownerName: "Ember", guildName: "" },
  structureType: StructureType.Camp,
  hasWonder: false,
} satisfies StructureInfo;

describe("compact entity label policy", () => {
  it("uses the army owner name and falls back to the entity id", () => {
    expect(resolveArmyCompactEntityLabel(baseArmy)).toBe("Sable Order");
    expect(resolveArmyCompactEntityLabel({ ...baseArmy, owner: { ...baseArmy.owner, ownerName: "" } })).toBe(
      "Army #101",
    );
  });

  it("uses shared view-model compact identity and variants", () => {
    expect(resolveArmyCompactEntityLabel(baseArmy)).toBe("Sable Order");
    expect(resolveCompactEntityLabelVariant({ isMine: true, isAlly: false })).toBe("mine");
  });

  it("uses explicit realm and camp names before type fallbacks", () => {
    expect(resolveStructureCompactEntityLabel(baseStructure)).toBe("North Camp");
    expect(
      resolveStructureCompactEntityLabel({
        ...baseStructure,
        structureName: "",
        structureType: StructureType.Realm,
      }),
    ).toBe("Realm #202");
  });

  it("resolves ownership label variants", () => {
    expect(resolveCompactEntityLabelVariant({ isMine: true, isAlly: false })).toBe("mine");
    expect(resolveCompactEntityLabelVariant({ isMine: false, isAlly: true })).toBe("ally");
    expect(resolveCompactEntityLabelVariant({ isMine: false, isAlly: false })).toBe("enemy");
    expect(resolveCompactEntityLabelVariant({ isMine: false, isAlly: false, isDaydreamsAgent: true })).toBe("agent");
  });
});
