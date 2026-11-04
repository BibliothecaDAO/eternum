// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import { Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArmyManager } from "./army-manager";

const ARMY = 7;
const GAME = 1;

const tile = (x: number, y: number) => ({
  getNormalized: () => ({ x, y }),
  getContract: () => ({ x, y }),
});

/** A Frontier game's rules: regions every 10 rows, so Ethereal I lies 10 rows below the surface. */
const store = {
  get: (model: string) =>
    ({
      SliceRules: { day_unit_seconds: 14_400 },
      SettlementRules: { spacing: 10 },
      GameRegistry: { start_main_at: 86_400n, end_at: 10_000_000n, seed: 1n },
    })[model],
};

/** The player's army beside its spire on the surface, drawn in view, with a model that records walks. */
const managerWithArmyBesideSpire = () => {
  const manager = Object.assign(Object.create(ArmyManager.prototype), {
    store,
    layerRevision: 0,
    armyPresentations: new Map([
      [ARMY, { entityId: ARMY, hexCoords: tile(25, 46), isMine: true, category: "Paladin", tier: "T1" }],
    ]),
    visibleArmyOrder: [ARMY],
    visibleArmyOrderIndices: new Map([[ARMY, 0]]),
    visibleArmyIndices: new Map([[ARMY, 0]]),
    movingArmySourceBuckets: new Map(),
    movementStartListeners: new Map(),
    movementCompleteListeners: new Map(),
    movementVisualCancelListeners: new Map(),
    activeArmyAttachmentEntities: new Set(),
    armyAttachmentSignatures: new Map(),
    orderedRoutes: new Map(),
    // The map is drawing around the new view: the arrival is drawn once the chunk settles.
    isArmyChunkTransitioning: true,
    deferredArmyQueue: new Set(),
    toNumericId: (entityId: number) => entityId,
    resolveLiveExplorerTroops: () => undefined,
    getArmyWorldPositionInto: (target: Vector3, hex: ReturnType<typeof tile>) =>
      target.set(hex.getNormalized().x, 0, hex.getNormalized().y),
    pathColourOf: () => "#ffffff",
    armyModel: {
      getEntitySlot: () => 0,
      isEntityMoving: () => false,
      startMovement: vi.fn(),
      setMovementCompleteCallback: vi.fn(),
      freeInstanceSlot: vi.fn(),
    },
    pathRenderer: { createPath: vi.fn(), removePath: vi.fn() },
    plates: { removeLabel: vi.fn() },
  });
  return manager;
};

describe("an army through its spire", () => {
  afterEach(() => vi.restoreAllMocks());

  it("stands at its arrival in the Ethereal layer at once: no walk and no path across the void", async () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(GAME);
    const manager = managerWithArmyBesideSpire();

    // enter_depth (Ethereal I): the same column, a region down the map.
    await manager.moveArmy(ARMY, tile(25, 56));

    expect(manager.armyModel.startMovement).not.toHaveBeenCalled();
    expect(manager.pathRenderer.createPath).not.toHaveBeenCalled();
    expect(manager.armyPresentations.get(ARMY).hexCoords.getContract()).toEqual({ x: 25, y: 56 });
    // Gone from where it stood, and drawn at its arrival once the new view's chunk is in.
    expect(manager.visibleArmyIndices.has(ARMY)).toBe(false);
    expect(manager.armyModel.freeInstanceSlot).toHaveBeenCalledWith(ARMY, 0);
    expect([...manager.deferredArmyQueue]).toEqual([ARMY]);
  });

  it("still walks a step inside its region, along a drawn path", async () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(GAME);
    const manager = managerWithArmyBesideSpire();

    await manager.moveArmy(ARMY, tile(26, 46));

    expect(manager.armyModel.startMovement).toHaveBeenCalledOnce();
    expect(manager.pathRenderer.createPath).toHaveBeenCalledWith(
      ARMY,
      [new Vector3(25, 0, 46), new Vector3(26, 0, 46)],
      "#ffffff",
    );
  });
});
