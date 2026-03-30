import { describe, expect, it } from "vitest";
import { StructureType } from "@bibliothecadao/types";
import {
  canTransferMilitaryInventoryBetweenStructures,
  canTransferMilitaryInventoryFromStructure,
  isVillageLikeStructureCategory,
  resolveArmyToStructureTransferRestriction,
  resolveStructureUiCapabilities,
  type StructureCapabilityTarget,
} from "./structure-capabilities";

const createStructure = ({
  category,
  entityId,
  fieldArmySlots = 0,
  guardArmySlots = 0,
  villageRealm,
}: {
  category: StructureType;
  entityId: number;
  fieldArmySlots?: number;
  guardArmySlots?: number;
  villageRealm?: number;
}): StructureCapabilityTarget => ({
  category,
  entity_id: entityId,
  base: {
    category,
    troop_max_explorer_count: fieldArmySlots,
    troop_max_guard_count: guardArmySlots,
  },
  metadata: villageRealm ? { village_realm: villageRealm } : {},
});

describe("resolveStructureUiCapabilities", () => {
  it("treats camps as construction, production, transfer, and field-army structures", () => {
    const capabilities = resolveStructureUiCapabilities(
      createStructure({
        category: StructureType.Camp,
        entityId: 7,
        fieldArmySlots: 1,
        guardArmySlots: 1,
      }),
    );

    expect(capabilities.canCreateFieldArmy).toBe(true);
    expect(capabilities.canManageGuardArmy).toBe(true);
    expect(capabilities.canOpenConstruction).toBe(true);
    expect(capabilities.canOpenProduction).toBe(true);
    expect(capabilities.canOpenTransferInventory).toBe(true);
    expect(capabilities.hasPopulationDetails).toBe(true);
    expect(capabilities.isVillageLike).toBe(true);
  });

  it("keeps fragment mines and hyperstructures defense-only", () => {
    const fragmentMine = resolveStructureUiCapabilities(
      createStructure({
        category: StructureType.FragmentMine,
        entityId: 9,
        guardArmySlots: 1,
      }),
    );
    const hyperstructure = resolveStructureUiCapabilities(
      createStructure({
        category: StructureType.Hyperstructure,
        entityId: 11,
        guardArmySlots: 4,
      }),
    );

    expect(fragmentMine.canCreateFieldArmy).toBe(false);
    expect(fragmentMine.canManageGuardArmy).toBe(true);
    expect(fragmentMine.canOpenTransferInventory).toBe(true);
    expect(fragmentMine.canOpenConstruction).toBe(false);

    expect(hyperstructure.canCreateFieldArmy).toBe(false);
    expect(hyperstructure.canManageGuardArmy).toBe(true);
    expect(hyperstructure.guardArmySlots).toBe(4);
    expect(hyperstructure.canOpenTransferInventory).toBe(true);
  });
});

describe("Blitz military transfer rules", () => {
  it("allows troop inventory transfers between owned Blitz structures with inventory", () => {
    const camp = createStructure({
      category: StructureType.Camp,
      entityId: 12,
      fieldArmySlots: 1,
      guardArmySlots: 1,
    });
    const hyperstructure = createStructure({
      category: StructureType.Hyperstructure,
      entityId: 15,
      guardArmySlots: 4,
    });
    const bank = createStructure({
      category: StructureType.Bank,
      entityId: 18,
    });

    expect(canTransferMilitaryInventoryFromStructure("blitz", camp)).toBe(true);
    expect(canTransferMilitaryInventoryFromStructure("blitz", hyperstructure)).toBe(true);
    expect(
      canTransferMilitaryInventoryBetweenStructures({ modeId: "blitz", source: camp, destination: hyperstructure }),
    ).toBe(true);
    expect(canTransferMilitaryInventoryBetweenStructures({ modeId: "blitz", source: camp, destination: bank })).toBe(
      false,
    );
  });

  it("blocks army to structure troop returns for camps, rifts, and hyperstructures", () => {
    const realm = createStructure({
      category: StructureType.Realm,
      entityId: 24,
      fieldArmySlots: 2,
      guardArmySlots: 2,
    });
    const camp = createStructure({
      category: StructureType.Camp,
      entityId: 25,
      fieldArmySlots: 1,
      guardArmySlots: 1,
    });
    const fragmentMine = createStructure({
      category: StructureType.FragmentMine,
      entityId: 26,
      guardArmySlots: 1,
    });
    const hyperstructure = createStructure({
      category: StructureType.Hyperstructure,
      entityId: 27,
      guardArmySlots: 4,
    });

    expect(resolveArmyToStructureTransferRestriction({ modeId: "blitz", destination: realm })).toBeNull();
    expect(resolveArmyToStructureTransferRestriction({ modeId: "blitz", destination: camp })).toBe(
      "cannot transfer army to structure",
    );
    expect(resolveArmyToStructureTransferRestriction({ modeId: "blitz", destination: fragmentMine })).toBe(
      "cannot transfer army to structure",
    );
    expect(resolveArmyToStructureTransferRestriction({ modeId: "blitz", destination: hyperstructure })).toBe(
      "cannot transfer army to structure",
    );
    expect(resolveArmyToStructureTransferRestriction({ modeId: "eternum", destination: camp })).toBeNull();
  });
});

describe("Eternum military transfer rules", () => {
  it("keeps village-connected transfer restrictions outside Blitz", () => {
    const realm = createStructure({
      category: StructureType.Realm,
      entityId: 21,
      fieldArmySlots: 2,
      guardArmySlots: 2,
    });
    const connectedVillage = createStructure({
      category: StructureType.Village,
      entityId: 22,
      guardArmySlots: 1,
      villageRealm: 21,
    });
    const otherRealm = createStructure({
      category: StructureType.Realm,
      entityId: 23,
      fieldArmySlots: 2,
      guardArmySlots: 2,
    });

    expect(
      canTransferMilitaryInventoryBetweenStructures({ modeId: "eternum", source: realm, destination: otherRealm }),
    ).toBe(true);
    expect(
      canTransferMilitaryInventoryBetweenStructures({
        modeId: "eternum",
        source: connectedVillage,
        destination: realm,
      }),
    ).toBe(true);
    expect(
      canTransferMilitaryInventoryBetweenStructures({
        modeId: "eternum",
        source: connectedVillage,
        destination: otherRealm,
      }),
    ).toBe(false);
  });

  it("treats camps as village-like structures in Blitz UI grouping", () => {
    expect(isVillageLikeStructureCategory(StructureType.Camp)).toBe(true);
    expect(isVillageLikeStructureCategory(StructureType.Village)).toBe(true);
    expect(isVillageLikeStructureCategory(StructureType.FragmentMine)).toBe(false);
  });
});
