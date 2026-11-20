// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({ address: 1n }));
vi.mock("@/hooks/store/use-account-store", async (original) => ({
  ...(await original<typeof import("@/hooks/store/use-account-store")>()),
  accountAddress: () => viewer.address,
}));
vi.mock("@/three/utils/utils", async (original) => ({
  ...(await original<typeof import("@/three/utils/utils")>()),
  isAddressEqualToAccount: (address: bigint) => address === viewer.address,
}));
vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getActiveGameId: () => 1 },
}));

import { ArmyManager } from "./army-manager";

const ARMY = 7;
const RIVAL_HOME = 9;
const OWN_HOME = 3;

/** An army of another player on the map, drawn as an enemy, and the facts the viewer's Aspect membership comes from. */
const managerWithEnemyDrawnArmy = (aspects: Record<number, number>) => {
  const store = {
    get: (_model: string, key: { home: number | bigint }) =>
      aspects[Number(key.home)] === undefined ? undefined : { aspect: aspects[Number(key.home)] },
    structuresOwnedBy: () => [{ entity_id: OWN_HOME }],
  };
  const refreshed: Array<{ isAlly: boolean; color: string }> = [];
  const manager = Object.assign(Object.create(ArmyManager.prototype), {
    store,
    armyPresentations: new Map([
      [
        ARMY,
        {
          entityId: ARMY,
          hexCoords: { getContract: () => ({ x: 10, y: 10 }) },
          isMine: false,
          isAlly: false,
          owner: { address: 2n, ownerName: "rival", guildName: "" },
          owningStructureId: RIVAL_HOME,
          category: "Paladin",
          tier: "T1",
          color: "#ff0000",
        },
      ],
    ]),
    visibleArmyIndices: new Map([[ARMY, 0]]),
    toNumericId: (entityId: number) => entityId,
    groundBiomeOrLand: () => "Grassland",
    refreshArmyCompactLabel: vi.fn(),
    refreshArmyInstance: vi.fn((army: { isAlly: boolean; color: string }) => refreshed.push({ ...army })),
    syncVisibleSlots: vi.fn(),
    armyModel: { getModelTypeForEntity: () => "paladin", flushInstanceUploads: vi.fn() },
  });
  // As it was drawn: an enemy, in the enemy colour.
  manager.armyPresentations.get(ARMY).color = manager.getArmyColor({
    isMine: false,
    isAlly: false,
    owner: { address: 2n },
  });
  return { manager, refreshed };
};

describe("an army drawn before its Aspect was known", () => {
  it("is redrawn in the ally colour when the viewer's refresh finds it shares the viewer's Aspect", () => {
    const { manager, refreshed } = managerWithEnemyDrawnArmy({ [OWN_HOME]: 1, [RIVAL_HOME]: 1 });
    const enemyColor = manager.armyPresentations.get(ARMY).color;

    manager.recheckOwnership();

    const army = manager.armyPresentations.get(ARMY);
    expect(army.isAlly).toBe(true);
    expect(army.color).not.toBe(enemyColor);
    expect(refreshed).toEqual([{ ...army, isAlly: true, color: army.color }]);
  });

  it("stays an enemy when the refresh finds another Aspect", () => {
    const { manager, refreshed } = managerWithEnemyDrawnArmy({ [OWN_HOME]: 1, [RIVAL_HOME]: 2 });

    manager.recheckOwnership();

    expect(manager.armyPresentations.get(ARMY).isAlly).toBe(false);
    expect(refreshed).toEqual([]);
  });
});
