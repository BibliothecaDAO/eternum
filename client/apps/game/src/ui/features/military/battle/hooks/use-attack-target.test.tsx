import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";

import { useAttackTargetData } from "./use-attack-target";

const {
  componentsMock,
  getBlockTimestampMock,
  getExplorerFromToriiClientMock,
  getTileAtMock,
  toriiClientMock,
  getStructureFromToriiClientMock,
} = vi.hoisted(() => ({
  componentsMock: {
    Structure: Symbol("Structure"),
    ExplorerTroops: Symbol("ExplorerTroops"),
    ProductionBoostBonus: Symbol("ProductionBoostBonus"),
  },
  getBlockTimestampMock: vi.fn(() => ({
    currentBlockTimestamp: 0,
    currentDefaultTick: 0,
    currentArmiesTick: 0,
  })),
  getExplorerFromToriiClientMock: vi.fn(async () => ({
    explorer: {
      troops: {
        count: 1000n,
        category: 1,
        tier: 1,
        stamina: {
          amount: 0n,
          updated_tick: 0n,
        },
        boosts: {
          incr_damage_dealt_percent_num: 0,
          incr_damage_dealt_end_tick: 0,
          decr_damage_gotten_percent_num: 0,
          decr_damage_gotten_end_tick: 0,
          incr_stamina_regen_percent_num: 0,
          incr_stamina_regen_tick_count: 0,
          incr_explore_reward_percent_num: 0,
          incr_explore_reward_end_tick: 0,
        },
        battle_cooldown_end: 0,
      },
    },
    resources: undefined,
  })),
  getTileAtMock: vi.fn(() => ({
    occupier_id: 321,
    occupier_is_structure: false,
    col: 10,
    row: 12,
  })),
  toriiClientMock: {},
  getStructureFromToriiClientMock: vi.fn(),
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    network: {
      toriiClient: toriiClientMock,
    },
    setup: {
      components: componentsMock,
    },
  }),
}));

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: vi.fn(() => undefined),
}));

vi.mock("@dojoengine/react", () => ({
  useComponentValue: vi.fn(() => undefined),
}));

vi.mock("@bibliothecadao/torii", () => ({
  getExplorerFromToriiClient: getExplorerFromToriiClientMock,
  getStructureFromToriiClient: getStructureFromToriiClientMock,
}));

vi.mock("@/services/api", () => ({
  sqlApi: {
    fetchExplorerAddressOwner: vi.fn(async () => null),
  },
}));

vi.mock("@/ui/utils/utils", () => ({
  getEntityIdFromKeys: vi.fn(() => "entity"),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  DEFAULT_COORD_ALT: false,
  getBlockTimestamp: getBlockTimestampMock,
  getArmyRelicEffects: vi.fn(() => []),
  getStructureArmyRelicEffects: vi.fn(() => []),
  getStructureRelicEffects: vi.fn(() => []),
  getTileAt: getTileAtMock,
  configManager: {
    getTick: () => 1,
  },
  ResourceManager: {
    getResourceBalances: vi.fn(() => []),
    getResourceBalancesWithProduction: vi.fn(() => []),
  },
  StaminaManager: {
    getStamina: vi.fn((_troops: unknown, currentArmiesTick: number) => ({
      amount: BigInt(currentArmiesTick * 10),
      updated_tick: BigInt(currentArmiesTick),
    })),
  },
}));

let latestResult: ReturnType<typeof useAttackTargetData> | null = null;

function HookHarness() {
  latestResult = useAttackTargetData(1 as never, { x: 5, y: 6 });
  return null;
}

describe("useAttackTargetData", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestResult = null;
    useBlockTimestampStore.setState({
      currentBlockTimestamp: 0,
      currentDefaultTick: 0,
      currentArmiesTick: 1,
      armiesTickTimeRemaining: 0,
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("derives target stamina from the live armies tick instead of freezing the fetch-time value", async () => {
    await act(async () => {
      root.render(<HookHarness />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(latestResult?.target?.info[0]?.stamina.amount).toBe(10n);

    await act(async () => {
      useBlockTimestampStore.setState({
        currentArmiesTick: 2,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(latestResult?.target?.info[0]?.stamina.amount).toBe(20n);
  });
});
