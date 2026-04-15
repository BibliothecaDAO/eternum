// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";

const TEST_CAMERA_VIEW = {
  Close: 1,
  Medium: 2,
  Far: 3,
} as const;

vi.mock("../../scenes/hexagon-scene", () => ({
  CameraView: TEST_CAMERA_VIEW,
}));

vi.mock("@bibliothecadao/eternum", () => ({
  Position: class MockPosition {
    constructor(value: Record<string, unknown>) {
      Object.assign(this, value);
    }
  },
}));

vi.mock("@/config/game-modes", () => ({
  getGameModeConfig: () => ({
    assets: {
      labels: {
        fragmentMine: "/images/labels/fragment_mine.png",
      },
    },
  }),
}));

const { StructureLabelType } = await import("./structure-label-type");

const buildStructureLabelData = (overrides: Record<string, unknown> = {}) =>
  ({
    entityId: 7,
    structureName: "Aurora",
    hexCoords: { x: 1, y: 2 },
    structureType: StructureType.Realm,
    stage: 1,
    initialized: true,
    level: 3,
    isMine: false,
    isAlly: false,
    hasWonder: false,
    owner: {
      address: 123n,
      ownerName: "Alice",
      guildName: "Guild",
    },
    ...overrides,
  }) as any;

describe("StructureLabelType realm army generation", () => {
  it("creates a realm army generation badge above the owner row", () => {
    const element = StructureLabelType.createElement(
      buildStructureLabelData({
        activeArmyProduction: [
          { resourceId: ResourcesIds.Knight, outputPerTick: 3n * BigInt(RESOURCE_PRECISION), buildingCount: 2 },
        ],
      }),
      TEST_CAMERA_VIEW.Close,
    );

    const badge = element.querySelector('[data-component="realm-army-generation"]');
    const owner = element.querySelector('[data-component="owner"]');

    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("ARMY GEN");
    expect(badge?.textContent).toContain("+3/tick");
    expect(badge?.nextElementSibling).toBe(owner);
  });

  it("omits the realm army generation badge for non-realms and empty generation", () => {
    const emptyRealm = StructureLabelType.createElement(buildStructureLabelData(), TEST_CAMERA_VIEW.Close);
    const nonRealm = StructureLabelType.createElement(
      buildStructureLabelData({
        structureType: StructureType.Village,
        activeArmyProduction: [
          { resourceId: ResourcesIds.Knight, outputPerTick: 3n * BigInt(RESOURCE_PRECISION), buildingCount: 2 },
        ],
      }),
      TEST_CAMERA_VIEW.Close,
    );

    expect(emptyRealm.querySelector('[data-component="realm-army-generation"]')).toBeNull();
    expect(nonRealm.querySelector('[data-component="realm-army-generation"]')).toBeNull();
  });

  it("keeps the existing badge node stable while updating its contents", () => {
    const element = StructureLabelType.createElement(
      buildStructureLabelData({
        activeArmyProduction: [
          { resourceId: ResourcesIds.Knight, outputPerTick: 3n * BigInt(RESOURCE_PRECISION), buildingCount: 2 },
          { resourceId: ResourcesIds.CrossbowmanT2, outputPerTick: 1n * BigInt(RESOURCE_PRECISION), buildingCount: 1 },
          { resourceId: ResourcesIds.PaladinT3, outputPerTick: 4n * BigInt(RESOURCE_PRECISION), buildingCount: 4 },
          { resourceId: ResourcesIds.KnightT3, outputPerTick: 3n * BigInt(RESOURCE_PRECISION), buildingCount: 3 },
        ],
      }),
      TEST_CAMERA_VIEW.Close,
    );

    const badge = element.querySelector('[data-component="realm-army-generation"]') as HTMLElement | null;
    expect(badge).not.toBeNull();

    StructureLabelType.updateElement?.(
      element,
      buildStructureLabelData({
        activeArmyProduction: [
          { resourceId: ResourcesIds.Paladin, outputPerTick: 5n * BigInt(RESOURCE_PRECISION), buildingCount: 5 },
        ],
      }),
      TEST_CAMERA_VIEW.Close,
    );

    const nextBadge = element.querySelector('[data-component="realm-army-generation"]') as HTMLElement | null;
    expect(nextBadge).toBe(badge);
    expect(nextBadge?.textContent).toContain("+5/tick");
    expect(nextBadge?.textContent).not.toContain("+1");
  });

  it("removes a stale realm army generation badge when the label updates to a non-realm", () => {
    const element = StructureLabelType.createElement(
      buildStructureLabelData({
        activeArmyProduction: [
          { resourceId: ResourcesIds.Knight, outputPerTick: 3n * BigInt(RESOURCE_PRECISION), buildingCount: 2 },
        ],
      }),
      TEST_CAMERA_VIEW.Close,
    );

    expect(element.querySelector('[data-component="realm-army-generation"]')).not.toBeNull();

    StructureLabelType.updateElement?.(
      element,
      buildStructureLabelData({
        structureType: StructureType.Village,
        activeArmyProduction: undefined,
      }),
      TEST_CAMERA_VIEW.Close,
    );

    expect(element.querySelector('[data-component="realm-army-generation"]')).toBeNull();
  });
});
