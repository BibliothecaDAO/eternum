// @vitest-environment jsdom
import { Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { ArmyManager } from "./army-manager";

describe("army terrain placement", () => {
  it("re-grounds a standing army when its terrain arrives and leaves a marching army on its path", () => {
    let height = 0;
    const placed = new Map([
      [1, new Vector3(1, 0.03, 2)],
      [2, new Vector3(5, 0.03, 6)],
    ]);
    const armies = new Map([
      [1, { entityId: 1, hexCoords: { kind: "standing" } }],
      [2, { entityId: 2, hexCoords: { kind: "marching" } }],
    ]);
    const manager = Object.assign(Object.create(ArmyManager.prototype), {
      isDestroyed: false,
      armyPresentations: armies,
      armyPaths: new Map(),
      visibleArmyIndices: new Map([
        [1, 0],
        [2, 1],
      ]),
      toNumericId: (entityId: number) => entityId,
      getArmyWorldPosition: (entityId: number) =>
        placed
          .get(entityId)!
          .clone()
          .setY(height + 0.03),
      armyModel: {
        isEntityMoving: (entityId: number) => entityId === 2,
        getInstanceData: (entityId: number) => ({ position: placed.get(entityId)! }),
        getEntityWorldPosition: (entityId: number) => placed.get(entityId)!.clone(),
        getAssignedModelType: () => "Knight1",
      },
      refreshArmyInstance: vi.fn((army: { entityId: number }) => placed.get(army.entityId)!.setY(height + 0.03)),
      markVisibleArmyPresentationDirty: vi.fn(),
    });

    manager.refreshTerrainPlacement();
    expect(manager.refreshArmyInstance).not.toHaveBeenCalled();

    height = 0.12;
    manager.refreshTerrainPlacement();
    expect(manager.refreshArmyInstance).toHaveBeenCalledTimes(1);
    expect(manager.refreshArmyInstance).toHaveBeenCalledWith(armies.get(1), 0, "Knight1");
    expect(manager.markVisibleArmyPresentationDirty).toHaveBeenCalledTimes(1);

    manager.refreshTerrainPlacement();
    expect(manager.refreshArmyInstance).toHaveBeenCalledTimes(1);
  });
});
