// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import { Vector3 } from "three";
import { deepScenario } from "@/lab/game/deep-scenario";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    plates: {
      setLabel: vi.fn(({ plate }: { plate: ArmyPlate }) => drawn.push(plate)),
      setPosition: vi.fn(),
      removeLabel: vi.fn(),
    },
  });
  manager.markVisibleArmyPresentationDirty(false);
  manager.flushVisibleArmyPresentation();
  return { manager, drawn };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a walking army's plate", () => {
  it("shows the stamina its army has now, not what it had when the map last rendered", async () => {
    // An explore costs 20 stamina: a segment of the plate's bar.
    vi.spyOn(configManager, "getExploreStaminaCost").mockReturnValue(20);
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
    expect(drawn.at(-1)?.stamina).toEqual({ current: 60, max: 150, perExplore: 20 });

    // A frame mid-walk moves the plate where the army stands and draws no older bar over it.
    drawn.length = 0;
    manager.updateVisibleArmyPresentation();
    expect(drawn).toEqual([]);
    expect(manager.plates.setPosition).toHaveBeenCalledWith(ARMY, expect.any(Vector3));
  });
});

it("draws the Deep count at each chain tick without changing or charging the stored army twice", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getExploreStaminaCost").mockReturnValue(20);
  const scenario = deepScenario();
  const { manager, drawn } = managerWithVisibleArmy(120);
  manager.store = scenario.store;
  const entityId = 201;
  manager.armyPresentations = new Map([[entityId, { ...armyRecord(120), entityId }]]);
  manager.resolveArmyStaminaSnapshot = () => ({ current: 120, max: 150 });
  const source = scenario.store.require("ExplorerTroops", { game_id: 1, explorer_id: entityId });
  const rule = scenario.store.require("DeepRules", { game_id: 1 });
  const interval = Number(scenario.store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds);
  const next = (Math.floor(scenario.startsAt / interval) + 1) * interval;
  manager.refreshArmyStamina(entityId, next);
  expect(drawn.at(-1)?.troops.count).toBe(Number(source.troops.count - rule.loss_per_tick) / 1e9);
  manager.refreshArmyStamina(entityId, next + interval);
  expect(drawn.at(-1)?.troops.count).toBe(Number(source.troops.count - 2n * rule.loss_per_tick) / 1e9);
  expect(scenario.store.require("ExplorerTroops", { game_id: 1, explorer_id: entityId })).toBe(source);
});
