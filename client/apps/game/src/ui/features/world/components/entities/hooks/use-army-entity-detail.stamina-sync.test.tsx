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

// Partial mock: keep the real exports — the hook needs gameEntityKey (re-
// exported through @/dojo/game-scope) and source-resolution delegates its
// freshness comparison to core's pickFresherArmyStaminaReading — and stub
// only what the assertions steer.
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
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

  it("reads troop stamina from live RECS", async () => {
    await act(async () => {
      root.render(<Capture />);
    });

    expect(captured?.stamina.amount).toBe(20n);
    expect(captured?.stamina.updated_tick).toBe(5n);
    expect(captured?.maxStamina).toBe(120);
    expect(captured?.staminaDisplay?.displayCurrent).toBe(20);
  });

  it("does not substitute a newer one-shot Torii snapshot for live RECS", async () => {
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

    expect(captured?.stamina.amount).toBe(20n);
    expect(captured?.stamina.updated_tick).toBe(5n);
    expect(captured?.maxStamina).toBe(120);
    expect(captured?.staminaDisplay?.displayCurrent).toBe(20);
  });

  it("follows a same-tick live RECS spend in place, without a remount", async () => {
    // Aug 13 playtest: chained moves land within one 60s armies tick, so the
    // post-move ExplorerTroops row ties with the panel's one-shot torii
    // snapshot on updated_tick. The open panel must follow the live row to
    // the post-move amount — deselect/reselect (remount refetch) must not be
    // required.
    const preMoveTroops = {
      ...snapshotTroops,
      stamina: { amount: 30n, updated_tick: 5n },
    };
    const postMoveLiveTroops = {
      ...snapshotTroops,
      stamina: { amount: 0n, updated_tick: 5n },
    };

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: [string] }) => {
      if (queryKey[0] === "explorer") {
        return {
          data: {
            explorer: {
              troops: preMoveTroops,
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
      troops: preMoveTroops,
    });

    getStaminaMock.mockImplementation((troops: typeof snapshotTroops) => {
      if (troops === postMoveLiveTroops) {
        return { amount: 0n, updated_tick: 5n };
      }

      return { amount: 30n, updated_tick: 5n };
    });

    await act(async () => {
      root.render(<Capture />);
    });

    expect(captured?.staminaDisplay?.displayCurrent).toBe(30);

    // The move resolves: live RECS delivers the same-tick spend. The query
    // snapshot still holds 30, but is not a stamina source.
    useComponentValueMock.mockReturnValue({
      troops: postMoveLiveTroops,
    });

    await act(async () => {
      root.render(<Capture />);
    });

    expect(captured?.stamina.amount).toBe(0n);
    expect(captured?.stamina.updated_tick).toBe(5n);
    expect(captured?.maxStamina).toBe(120);
    expect(captured?.staminaDisplay?.displayCurrent).toBe(0);
  });
});
