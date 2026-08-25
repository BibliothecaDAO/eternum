import { Position } from "@bibliothecadao/eternum";
import { BuildingType, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import type { ArmyData, StructureInfo } from "../../types";
import {
  buildArmyEntityLabelViewModel,
  buildChestEntityLabelViewModel,
  buildStructureEntityLabelViewModel,
  resolveArmyTitle,
  resolveStructureTitle,
} from "./entity-label-view-model";

const army = {
  entityId: 101,
  hexCoords: new Position({ x: 1, y: 2 }),
  isMine: true,
  owningStructureId: null,
  owner: { address: 123n, ownerName: "Sable Order", guildName: "" },
  color: "#ffffff",
  category: TroopType.Knight,
  tier: TroopTier.T2,
  isDaydreamsAgent: false,
  troopCount: 1500,
  currentStamina: 75,
  maxStamina: 100,
} satisfies ArmyData;

const structure = {
  structureName: "North Camp",
  entityId: 202,
  hexCoords: { col: 3, row: 4 },
  stage: 1,
  initialized: true,
  level: 1,
  isMine: false,
  isAlly: true,
  owner: { address: 456n, ownerName: "Ember", guildName: "" },
  structureType: StructureType.Camp,
  hasWonder: false,
  guardArmies: [{ slot: 1, category: "Knight", tier: 2, count: 1500, stamina: 42 }],
  activeProductions: [{ buildingCount: 3, buildingType: BuildingType.ResourceWood }],
} satisfies StructureInfo;

describe("entity label view model", () => {
  it("builds army identity and expanded metrics from one model", () => {
    const model = buildArmyEntityLabelViewModel(army);

    expect(model).toMatchObject({
      kind: "army",
      entityId: 101,
      title: "Sable Order",
      compactText: "Sable Order",
      relation: "mine",
      variant: "mine",
      iconKey: "army",
    });
    expect(model.detailRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Troops", value: "1.5k", meta: "Knight T2" }),
        expect.objectContaining({ label: "Stamina", value: "75/100" }),
      ]),
    );
  });

  it("builds structure identity, guards, guard stamina, and production detail", () => {
    const model = buildStructureEntityLabelViewModel(structure);

    expect(model).toMatchObject({
      kind: "structure",
      entityId: 202,
      title: "North Camp",
      compactText: "North Camp",
      relation: "ally",
      variant: "ally",
    });
    expect(model.detailRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Owner", value: "Ember" }),
        expect.objectContaining({ label: "Guards", value: "1.5k", meta: "Knight T2" }),
        expect.objectContaining({ label: "Guard stamina", value: "42" }),
        expect.objectContaining({ label: "Buildings", value: "3" }),
      ]),
    );
  });

  it("builds stable chest identity", () => {
    expect(buildChestEntityLabelViewModel({ entityId: 303 })).toMatchObject({
      kind: "chest",
      entityId: 303,
      title: "Relic Crate",
      compactText: "Relic Crate",
      relation: "neutral",
      variant: "neutral",
      iconKey: "chest",
    });
  });

  // Phase 3.3: the compact label only needs the title, but the compact resolver built
  // the entire view model (incl. detailRows) per moving army per frame. These standalone
  // resolvers are exported so the compact path can produce the title directly.
  describe("standalone title resolvers", () => {
    it("resolves the army title (owner name, else entity id fallback) matching compactText", () => {
      expect(resolveArmyTitle(army)).toBe("Sable Order");
      expect(resolveArmyTitle({ ...army, owner: { ...army.owner, ownerName: "" } })).toBe("Army #101");
      expect(resolveArmyTitle(army)).toBe(buildArmyEntityLabelViewModel(army).compactText);
    });

    it("resolves the structure title (name, else type + id fallback) matching compactText", () => {
      expect(resolveStructureTitle(structure)).toBe(buildStructureEntityLabelViewModel(structure).compactText);
      expect(resolveStructureTitle({ ...structure, structureName: "", structureType: StructureType.Realm })).toBe(
        "Realm #202",
      );
    });
  });
});
