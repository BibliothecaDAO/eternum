import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  useBlockTimestamp: () => ({
    currentBlockTimestamp: 0,
    currentDefaultTick: 0,
    currentArmiesTick: 5,
    armiesTickTimeRemaining: 0,
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

const Probe = () => {
  const { derivedData } = useArmyEntityDetail({ armyEntityId: 1 as never });
  return <div>{derivedData ? `${Number(derivedData.stamina.amount)}/${derivedData.maxStamina}` : "loading"}</div>;
};

describe("useArmyEntityDetail stamina sync", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

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
      root.render(<Probe />);
    });

    expect(container.textContent).toContain("20/120");
  });
});
