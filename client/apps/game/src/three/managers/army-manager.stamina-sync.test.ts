// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

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

  if (globalThis.navigator && typeof globalThis.navigator.getBattery !== "function") {
    Object.defineProperty(globalThis.navigator, "getBattery", {
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
      updateArmyLabelData: vi.fn(),
    };

    ArmyManager.prototype["recomputeStaminaForAllArmies"].call(fakeManager);

    expect(getComponentValueMock).toHaveBeenCalled();
    expect(army.currentStamina).toBe(50);
  });
});
