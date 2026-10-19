// @vitest-environment jsdom
import { Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import type { ArmyPlate } from "../map-plates/map-plate-model";
import { ArmyManager } from "./army-manager";

const ARMY = 5;

const armyRecord = (stamina: number) => ({
  entityId: ARMY,
  hexCoords: { getNormalized: () => ({ x: 10, y: 10 }) },
  isMine: false,
  owner: { address: 1n, ownerName: "clientlane", guildName: "" },
  owningStructureId: null,
  category: "Knight",
  tier: "T1",
  troopCount: 375,
  currentStamina: stamina,
  maxStamina: 150,
  color: "#ffffff",
});

/** An army on the map, as a chunk render leaves it: visible, standing, its plate drawn. */
const managerWithVisibleArmy = (stamina: number) => {
  let moving = false;
  const drawn: ArmyPlate[] = [];
  const manager = Object.assign(Object.create(ArmyManager.prototype), {
    isDestroyed: false,
    store: null,
    armyPresentations: new Map([[ARMY, armyRecord(stamina)]]),
    visibleArmyOrder: [ARMY],
    visibleArmyIndices: new Map([[ARMY, 0]]),
    armyPaths: new Map(),
    movingArmySourceBuckets: new Map(),
    movementStartListeners: new Map(),
    activeArmyAttachmentEntities: new Set(),
    armyAttachmentSignatures: new Map(),
    staminaUnresolved: new Set(),
    contentLadder: { labels: true },
    labelPriorityContext: {},
    tempCompactLabelPosition: new Vector3(),
    selectedArmyForPath: null,
    toNumericId: (entityId: number) => entityId,
    getArmyWorldPositionInto: (out: Vector3) => out.set(0, 0, 0),
    getArmyColorProfile: () => ({ primary: "#ffffff" }),
    resolveFoodBlocked: () => false,
    armyModel: {
      getEntitySlot: () => 0,
      isEntityMoving: () => moving,
      hasMovingInstances: () => moving,
      getInstanceData: () => ({ isMoving: moving, position: new Vector3() }),
      startMovement: vi.fn(() => {
        moving = true;
      }),
      setMovementCompleteCallback: vi.fn(),
    },
    pathRenderer: { createPath: vi.fn() },
    plates: { setLabel: vi.fn(({ plate }: { plate: ArmyPlate }) => drawn.push(plate)), removeLabel: vi.fn() },
  });
  manager.markVisibleArmyPresentationDirty(false);
  manager.flushVisibleArmyPresentation();
  return { manager, drawn };
};

describe("a walking army's plate", () => {
  it("shows the stamina its army has now, not what it had when the map last rendered", async () => {
    const { manager, drawn } = managerWithVisibleArmy(120);

    // The explore confirms: the army walks onto the tile it revealed.
    await manager.applyMovementPlan({
      entityId: ARMY,
      numericEntityId: ARMY,
      sourceNormalized: { x: 10, y: 10 },
      targetNormalized: { x: 11, y: 10 },
      targetHexCoords: { getNormalized: () => ({ x: 11, y: 10 }) },
      path: [],
      worldPath: [new Vector3(), new Vector3(1, 0, 0)],
      armyCategory: "Knight",
      armyTier: "T1",
    });
    // The next chain second reads the bar the explore left: 60.
    manager.resolveArmyStaminaSnapshot = () => ({ current: 60, max: 150 });
    manager.refreshArmyStamina(ARMY, 1_792_397_846);

    // A frame mid-walk redraws the plate where the army stands.
    drawn.length = 0;
    manager.updateVisibleArmyPresentation();

    expect(drawn.map((plate) => plate.stamina)).toEqual([{ current: 60, max: 150 }]);
  });
});
