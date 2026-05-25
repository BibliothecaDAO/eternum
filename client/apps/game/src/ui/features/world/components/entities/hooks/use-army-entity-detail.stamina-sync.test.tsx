import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArmyStaminaSourceStore } from "@/lib/army-stamina/source-store";
import { useArmyEntityDetail } from "./use-army-entity-detail";

const {
  useQueryMock,
  useDojoMock,
  useComponentValueMock,
  getStaminaMock,
  getMaxStaminaMock,
  getAddressNameMock,
  getCharacterNameMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useDojoMock: vi.fn(),
  useComponentValueMock: vi.fn(),
  getStaminaMock: vi.fn(),
  getMaxStaminaMock: vi.fn(),
  getAddressNameMock: vi.fn(),
  getCharacterNameMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: useDojoMock,
}));

vi.mock("@dojoengine/react", () => ({
  useComponentValue: useComponentValueMock,
}));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentArmiesTick: () => 5,
  useBlockTimestamp: () => ({
    currentBlockTimestamp: 0,
    currentDefaultTick: 0,
    currentArmiesTick: 5,
    armiesTickTimeRemaining: 5,
  }),
}));

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({
    structure: {
      getName: () => ({ name: "Field Deployment" }),
    },
  }),
}));

vi.mock("@/utils/agent", () => ({
  getCharacterName: getCharacterNameMock,
}));

vi.mock("@bibliothecadao/torii", () => ({
  getExplorerFromToriiClient: vi.fn(),
  getStructureFromToriiClient: vi.fn(),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getTick: () => 10,
  },
  ContractAddress: (value: string | bigint) => value,
  getAddressName: getAddressNameMock,
  getArmyRelicEffects: () => [],
  getBlockTimestamp: () => ({
    currentBlockTimestamp: 0,
    currentDefaultTick: 0,
    currentArmiesTick: 5,
  }),
  getGuildFromPlayerAddress: () => undefined,
  StaminaManager: {
    getStamina: getStaminaMock,
    getMaxStamina: getMaxStaminaMock,
  },
}));

const snapshotTroops = {
  category: "Knight",
  tier: 1,
  count: 10n,
  stamina: { amount: 80n, updated_tick: 1n },
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

const liveTroops = {
  ...snapshotTroops,
  stamina: { amount: 20n, updated_tick: 5n },
};

const sameTickLiveTroops = {
  ...snapshotTroops,
  stamina: { amount: 80n, updated_tick: 5n },
};

const sameTickSnapshotTroops = {
  ...snapshotTroops,
  stamina: { amount: 20n, updated_tick: 5n },
};

type CapturedDerivedData = ReturnType<typeof useArmyEntityDetail>["derivedData"];

let captured: CapturedDerivedData;

const Capture = () => {
  const { derivedData } = useArmyEntityDetail({ armyEntityId: 1 as never });
  captured = derivedData;
  return null;
};

describe("useArmyEntityDetail stamina sync", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    captured = undefined;
    useArmyStaminaSourceStore.setState({
      pendingSources: {},
      authoritativeSources: {},
    });

    useDojoMock.mockReturnValue({
      network: { toriiClient: {} },
      account: { account: { address: "0x123" } },
      setup: {
        components: {
          ExplorerTroops: {},
        },
        systemCalls: {
          explorer_delete: vi.fn(),
        },
      },
    });

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: [string] }) => {
      if (queryKey[0] === "explorer") {
        return {
          data: {
            explorer: {
              troops: snapshotTroops,
              owner: "0x123",
            },
            resources: [],
            relicEffects: [],
          },
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return {
        data: {
          structure: {
            owner: "0x123",
          },
          resources: [],
        },
        isLoading: false,
        refetch: vi.fn(),
      };
    });

    useComponentValueMock.mockReturnValue({
      troops: liveTroops,
    });

    getStaminaMock.mockImplementation((troops: typeof snapshotTroops) => {
      if (troops === liveTroops) {
        return { amount: 20n, updated_tick: 5n };
      }

      return { amount: 80n, updated_tick: 5n };
    });
    getMaxStaminaMock.mockReturnValue(120);
    getAddressNameMock.mockReturnValue("Alice");
    getCharacterNameMock.mockReturnValue("Knight");
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("prefers live troop stamina over the stale Torii snapshot", async () => {
    await act(async () => {
      root.render(<Capture />);
    });

    expect(captured?.stamina.amount).toBe(20n);
    expect(captured?.stamina.updated_tick).toBe(5n);
    expect(captured?.maxStamina).toBe(120);
    expect(captured?.staminaDisplay?.displayCurrent).toBe(20);
  });

  it("prefers the newer Torii troop stamina when the live troop snapshot is stale", async () => {
    const newerSnapshotTroops = {
      ...snapshotTroops,
      stamina: { amount: 65n, updated_tick: 9n },
    };
    const staleLiveTroops = {
      ...liveTroops,
      stamina: { amount: 20n, updated_tick: 5n },
    };

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: [string] }) => {
      if (queryKey[0] === "explorer") {
        return {
          data: {
            explorer: {
              troops: newerSnapshotTroops,
              owner: "0x123",
            },
            resources: [],
            relicEffects: [],
          },
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return {
        data: {
          structure: {
            owner: "0x123",
          },
          resources: [],
        },
        isLoading: false,
        refetch: vi.fn(),
      };
    });

    useComponentValueMock.mockReturnValue({
      troops: staleLiveTroops,
    });

    getStaminaMock.mockImplementation((troops: typeof snapshotTroops) => {
      if (troops === staleLiveTroops) {
        return { amount: 20n, updated_tick: 5n };
      }

      if (troops === newerSnapshotTroops) {
        return { amount: 65n, updated_tick: 9n };
      }

      return { amount: 80n, updated_tick: 5n };
    });

    await act(async () => {
      root.render(<Capture />);
    });

    expect(captured?.stamina.amount).toBe(65n);
    expect(captured?.stamina.updated_tick).toBe(9n);
    expect(captured?.maxStamina).toBe(120);
    expect(captured?.staminaDisplay?.displayCurrent).toBe(65);
  });

  it("prefers the Torii snapshot when both snapshots share the same tick but differ in amount", async () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: [string] }) => {
      if (queryKey[0] === "explorer") {
        return {
          data: {
            explorer: {
              troops: sameTickSnapshotTroops,
              owner: "0x123",
            },
            resources: [],
            relicEffects: [],
          },
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return {
        data: {
          structure: {
            owner: "0x123",
          },
          resources: [],
        },
        isLoading: false,
        refetch: vi.fn(),
      };
    });

    useComponentValueMock.mockReturnValue({
      troops: sameTickLiveTroops,
    });

    getStaminaMock.mockImplementation((troops: typeof snapshotTroops, currentTick: number) => {
      if (troops === sameTickSnapshotTroops) {
        return { amount: currentTick === 5 ? 20n : 40n, updated_tick: BigInt(currentTick) };
      }

      if (troops === sameTickLiveTroops) {
        return { amount: 80n, updated_tick: 5n };
      }

      return { amount: 80n, updated_tick: 5n };
    });

    await act(async () => {
      root.render(<Capture />);
    });

    expect(captured?.stamina.amount).toBe(20n);
    expect(captured?.stamina.updated_tick).toBe(5n);
    expect(captured?.maxStamina).toBe(120);
    expect(captured?.staminaDisplay?.displayCurrent).toBe(20);
  });
});
