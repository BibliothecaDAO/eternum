// @vitest-environment jsdom

import { Position } from "@bibliothecadao/eternum";
import { BuildingType, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { CameraView } from "../../scenes/camera-view";
import type { StructureInfo } from "../../types";
import { createArmyLabel, createChestLabel, createStructureLabel } from "./label-factory";
import type { ArmyLabelData } from "./army-label-type";

const army = {
  entityId: 101,
  hexCoords: new Position({ x: 1, y: 2 }),
  isMine: true,
  owner: { address: 123n, ownerName: "Sable Order", guildName: "" },
  color: "#ffffff",
  category: TroopType.Knight,
  tier: TroopTier.T2,
  isDaydreamsAgent: false,
  troopCount: 1500,
  currentStamina: 75,
  maxStamina: 100,
} satisfies ArmyLabelData;

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

describe("label factory shared model rendering", () => {
  it("renders army hover labels from the shared title and metric model", () => {
    const label = createArmyLabel(army, CameraView.Medium);

    expect(label.dataset.labelTitle).toBe("Sable Order");
    expect(label.textContent).toContain("Sable Order");
    expect(label.textContent).toContain("1500");
    expect(label.textContent).toContain("75/100");
  });

  it("renders structure hover labels from the shared title, guard, stamina, and building model", () => {
    const label = createStructureLabel(structure, CameraView.Medium);

    expect(label.dataset.labelTitle).toBe("North Camp");
    expect(label.textContent).toContain("North Camp");
    expect(label.textContent).toContain("1500");
    expect(label.textContent).toContain("42");
    expect(label.textContent).toContain("3");
  });

  it("renders chest hover labels from the shared crate identity", () => {
    const label = createChestLabel({ entityId: 303, hexCoords: new Position({ x: 1, y: 1 }) }, CameraView.Medium);

    expect(label.dataset.labelTitle).toBe("Relic Crate");
    expect(label.textContent).toContain("Relic Crate");
  });
});
