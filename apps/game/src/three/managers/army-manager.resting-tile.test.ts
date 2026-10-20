// @vitest-environment jsdom
import { Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { ArmyManager } from "./army-manager";

const ARMY = 7;

const tile = (x: number, y: number) => ({
  getNormalized: () => ({ x, y }),
  getContract: () => ({ x, y }),
});

/**
 * Another player's army on the map, drawn on its tile, with an army model that tears a walk down the way its slot
 * purge and slot release do: the walk stops and its completion never runs.
 */
const managerWithForeignArmy = () => {
  let moving = false;
  const drawnAt: Vector3[] = [];
  const manager = Object.assign(Object.create(ArmyManager.prototype), {
    isDestroyed: false,
    store: null,
    scale: new Vector3(1, 1, 1),
    armyPresentations: new Map([
      [
        ARMY,
        {
          entityId: ARMY,
          hexCoords: tile(10, 10),
          isMine: false,
          owner: { address: 2n, ownerName: "rival", guildName: "" },
          owningStructureId: null,
          category: "Paladin",
          tier: "T1",
          troopCount: 1000,
          currentStamina: 120,
          maxStamina: 120,
          color: "#ffffff",
        },
      ],
    ]),
    visibleArmyOrder: [ARMY],
    visibleArmyIndices: new Map([[ARMY, 0]]),
    movingArmySourceBuckets: new Map(),
    movementStartListeners: new Map(),
    movementCompleteListeners: new Map(),
    activeArmyAttachmentEntities: new Set(),
    armyAttachmentSignatures: new Map(),
    staminaUnresolved: new Set(),
    contentLadder: { labels: false },
    labelPriorityContext: {},
    tempCompactLabelPosition: new Vector3(),
    selectedArmyForPath: null,
    toNumericId: (entityId: number) => entityId,
    getArmyWorldPosition: (_entityId: number, hex: ReturnType<typeof tile>) =>
      new Vector3(hex.getNormalized().x, 0, hex.getNormalized().y),
    getArmyColorProfile: () => ({ primary: "#ffffff" }),
    resolveFoodBlocked: () => false,
    armyModel: {
      getEntitySlot: () => 0,
      isEntityMoving: () => moving,
      getEntityWorldPosition: () => (moving ? new Vector3(10.5, 0, 10) : undefined),
      startMovement: vi.fn(() => {
        moving = true;
      }),
      stopWithoutCompletion: () => {
        moving = false;
      },
      setMovementCompleteCallback: vi.fn(),
      assignModelToEntity: vi.fn(),
      assignCosmeticToEntity: vi.fn(),
      clearCosmeticForEntity: vi.fn(),
      rebindMovementMatrixIndex: vi.fn(),
      updateInstance: vi.fn((_entityId: number, _slot: number, position: Vector3) => drawnAt.push(position.clone())),
    },
    pathRenderer: { createPath: vi.fn(), removePath: vi.fn() },
    plates: { setLabel: vi.fn(), setPosition: vi.fn(), removeLabel: vi.fn() },
  });
  return { manager, drawnAt };
};

describe("an army at rest", () => {
  it("is drawn on the tile it stands on, even when its last walk ended without completing", async () => {
    const { manager, drawnAt } = managerWithForeignArmy();

    // Its move lands from the chain: the army now stands one tile east, and its model starts the walk there.
    await manager.applyMovementPlan({
      entityId: ARMY,
      numericEntityId: ARMY,
      sourceNormalized: { x: 10, y: 10 },
      targetNormalized: { x: 11, y: 10 },
      targetHexCoords: tile(11, 10),
      path: [tile(10, 10), tile(11, 10)],
      worldPath: [new Vector3(10, 0, 10), new Vector3(11, 0, 10)],
      armyCategory: "Paladin",
      armyTier: "T1",
    });
    // The render-integrity heal purges a duplicate slot of this army mid-walk: the walk stops, its completion
    // never runs.
    manager.armyModel.stopWithoutCompletion();

    // The next redraw (a chunk render, a heal, a variant change) draws it where it stands.
    manager.refreshArmyInstance(manager.armyPresentations.get(ARMY), 0, "paladin");

    expect(drawnAt.at(-1)).toEqual(new Vector3(11, 0, 10));
  });
});
