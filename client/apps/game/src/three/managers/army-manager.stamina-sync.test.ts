// @vitest-environment jsdom

import { Position } from "@bibliothecadao/eternum";
import { describe, expect, it, vi } from "vitest";

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<{ level: number; charging: boolean }>;
}

const { getBlockTimestampMock, getComponentValueMock, getEntityIdFromKeysMock, getStaminaMock } = vi.hoisted(() => ({
  getBlockTimestampMock: vi.fn(() => ({
    currentBlockTimestamp: 0,
    currentDefaultTick: 0,
    currentArmiesTick: 5,
  })),
  getComponentValueMock: vi.fn(),
  getEntityIdFromKeysMock: vi.fn(() => 1),
  getStaminaMock: vi.fn(),
}));

vi.hoisted(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => "",
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
    })),
  );

  const currentUrl = globalThis.URL;
  if (currentUrl && typeof currentUrl.createObjectURL !== "function") {
    currentUrl.createObjectURL = vi.fn(() => "blob:test");
  }

  const navigatorWithBattery = globalThis.navigator as NavigatorWithBattery | undefined;
  if (navigatorWithBattery && typeof navigatorWithBattery.getBattery !== "function") {
    Object.defineProperty(navigatorWithBattery, "getBattery", {
      value: vi.fn(async () => ({ level: 1, charging: true })),
      configurable: true,
    });
  }
});

vi.mock("@bibliothecadao/eternum", async () => {
  const actual = await vi.importActual<object>("@bibliothecadao/eternum");
  return {
    ...actual,
    getBlockTimestamp: getBlockTimestampMock,
    StaminaManager: {
      getStamina: getStaminaMock,
      getMaxStamina: vi.fn(() => 120),
    },
  };
});

vi.mock("@dojoengine/recs", async () => {
  const actual = await vi.importActual<object>("@dojoengine/recs");
  return {
    ...actual,
    getComponentValue: getComponentValueMock,
  };
});

vi.mock("@dojoengine/utils", async () => {
  const actual = await vi.importActual<object>("@dojoengine/utils");
  return {
    ...actual,
    getEntityIdFromKeys: getEntityIdFromKeysMock,
  };
});

import { ArmyManager } from "./army-manager";

describe("ArmyManager stamina sync", () => {
  it("uses ExplorerTroops coordinate updates to advance cached army position when TileOpt is quiet", () => {
    const sourceHex = new Position({ x: 10, y: 20 });
    const targetHex = new Position({ x: 11, y: 21 });
    const army = {
      entityId: 1,
      hexCoords: sourceHex,
      isMine: true,
      owningStructureId: 99,
      owner: { address: 123n, ownerName: "Alice", guildName: "" },
      color: "#ffffff",
      category: "Knight",
      tier: 1,
      isDaydreamsAgent: false,
      troopCount: 10,
      currentStamina: 0,
      maxStamina: 120,
      onChainStamina: { amount: 10n, updatedTick: 1 },
    };
    const updateSpatialIndex = vi.fn();

    const fakeManager = Object.assign(Object.create(ArmyManager.prototype), {
      armies: new Map([[1, army]]),
      entityIdLabels: new Map(),
      visibleArmyIndices: new Map(),
      optimisticallyMovingArmies: new Set(),
      authoritativeReconciledArmies: new Set(),
      resolveArmyStaminaSnapshot: vi.fn(() => ({
        current: 15,
        max: 120,
        displayRatio: 0.125,
      })),
      resolveArmyOwnerFromStructure: vi.fn(() => ({
        ownerAddress: 123n,
        ownerName: "Alice",
      })),
      syncTrackedArmyOwnerState: vi.fn(),
      updateArmyLabelData: vi.fn(),
      updateSpatialIndex,
      refreshArmyPositionPresentation: vi.fn(),
    });

    ArmyManager.prototype.updateArmyFromExplorerTroopsUpdate.call(fakeManager, {
      entityId: 1,
      hexCoords: { col: 11, row: 21 },
      troopCount: 10,
      onChainStamina: { amount: 15n, updatedTick: 5 },
      ownerAddress: 123n,
      ownerName: "Alice",
      ownerStructureId: 99,
      battleCooldownEnd: 0,
    });

    const updatedArmy = fakeManager.armies.get(1);

    expect(updatedArmy?.hexCoords.getNormalized()).toEqual(targetHex.getNormalized());
    expect(updateSpatialIndex).toHaveBeenCalledWith(1, sourceHex, expect.any(Position));
  });

  it("recomputes passive stamina from live explorer troops when available", () => {
    const army = {
      entityId: 1,
      troopCount: 10,
      category: "Knight",
      tier: 1,
      onChainStamina: { amount: 10n, updatedTick: 1 },
      currentStamina: 0,
    };

    const liveTroops = {
      category: "Knight",
      tier: 1,
      count: 10n,
      stamina: {
        amount: 10n,
        updated_tick: 1n,
      },
      boosts: {
        incr_stamina_regen_percent_num: 5000,
        incr_stamina_regen_tick_count: 4,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
      },
      battle_cooldown_end: 0,
    };

    getComponentValueMock.mockReturnValue({
      troops: liveTroops,
    });

    getStaminaMock.mockImplementation((troops: typeof liveTroops) => ({
      amount: troops.boosts.incr_stamina_regen_percent_num > 0 ? 50n : 30n,
      updated_tick: 5n,
    }));

    const fakeManager = {
      armies: new Map([[1, army]]),
      entityIdLabels: new Map(),
      components: {
        ExplorerTroops: {},
      },
      resolveLiveExplorerTroops(entityId: number) {
        return ArmyManager.prototype["resolveLiveExplorerTroops"].call(this, entityId);
      },
      resolveArmyStaminaSnapshot(input: {
        entityId: number;
        troopCount: number;
        onChainStamina: { amount: bigint; updatedTick: number };
        category: any;
        tier: any;
      }) {
        return ArmyManager.prototype["resolveArmyStaminaSnapshot"].call(this, input);
      },
      updateArmyLabelData: vi.fn(),
    };

    ArmyManager.prototype["recomputeStaminaForAllArmies"].call(fakeManager);

    expect(getComponentValueMock).toHaveBeenCalled();
    expect(army.currentStamina).toBe(50);
  });

  it("falls back to cached on-chain stamina when the live explorer snapshot is older", () => {
    const army = {
      entityId: 1,
      troopCount: 10,
      category: "Knight",
      tier: 1,
      onChainStamina: { amount: 40n, updatedTick: 6 },
      currentStamina: 0,
    };

    const staleLiveTroops = {
      category: "Knight",
      tier: 1,
      count: 10n,
      stamina: {
        amount: 10n,
        updated_tick: 3n,
      },
      boosts: {
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_tick_count: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
      },
      battle_cooldown_end: 0,
    };

    getComponentValueMock.mockReturnValue({
      troops: staleLiveTroops,
    });

    getStaminaMock.mockImplementation((troops: typeof staleLiveTroops) => ({
      amount: troops.stamina.updated_tick === 3n ? 10n : 40n,
      updated_tick: troops.stamina.updated_tick,
    }));

    const fakeManager = {
      armies: new Map([[1, army]]),
      entityIdLabels: new Map(),
      components: {
        ExplorerTroops: {},
      },
      resolveLiveExplorerTroops(entityId: number) {
        return ArmyManager.prototype["resolveLiveExplorerTroops"].call(this, entityId);
      },
      resolveArmyStaminaSnapshot(input: {
        entityId: number;
        troopCount: number;
        onChainStamina: { amount: bigint; updatedTick: number };
        category: any;
        tier: any;
      }) {
        return ArmyManager.prototype["resolveArmyStaminaSnapshot"].call(this, input);
      },
      updateArmyLabelData: vi.fn(),
    };

    ArmyManager.prototype["recomputeStaminaForAllArmies"].call(fakeManager);

    expect(army.currentStamina).toBe(40);
  });
});
