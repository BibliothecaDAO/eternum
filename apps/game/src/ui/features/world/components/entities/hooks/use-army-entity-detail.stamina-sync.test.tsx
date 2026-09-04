import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArmyEntityDetail } from "./use-army-entity-detail";

const { useDojoMock, useComponentValueMock, getStaminaMock, getMaxStaminaMock } = vi.hoisted(() => ({
  useDojoMock: vi.fn(),
  useComponentValueMock: vi.fn(),
  getStaminaMock: vi.fn(),
  getMaxStaminaMock: vi.fn(),
}));

const components = {
  ExplorerTroops: Symbol("ExplorerTroops"),
  Resource: Symbol("Resource"),
  Structure: Symbol("Structure"),
};

vi.mock("@bibliothecadao/react", () => ({ useDojo: useDojoMock }));
vi.mock("@dojoengine/react", () => ({ useComponentValue: useComponentValueMock }));
vi.mock("@/sync/game-scope", () => ({ gameEntityKey: ([id]: [bigint]) => `entity:${id}` }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useBlockTimestamp: () => ({ currentArmiesTick: 5 }),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ structure: { getName: () => ({ name: "Field Deployment" }) } }),
}));
vi.mock("@/utils/agent", () => ({ getCharacterName: () => "Knight" }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getTick: () => 10 },
  ContractAddress: (value: string | bigint) => value,
  getAddressName: () => "Alice",
  getArmyRelicEffects: () => [],
  getGuildFromPlayerAddress: () => undefined,
  StaminaManager: {
    getStamina: getStaminaMock,
    getMaxStamina: getMaxStaminaMock,
  },
}));

const baseTroops = {
  category: "Knight",
  tier: 1,
  count: 10n,
  stamina: { amount: 30n, updated_tick: 5n },
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

let liveExplorer = { troops: baseTroops, owner: 9 };
let captured: ReturnType<typeof useArmyEntityDetail>["derivedData"];

const Capture = () => {
  captured = useArmyEntityDetail({ armyEntityId: 1 as never }).derivedData;
  return null;
};

describe("useArmyEntityDetail live RECS state", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    captured = undefined;
    liveExplorer = { troops: baseTroops, owner: 9 };
    useDojoMock.mockReturnValue({
      account: { account: { address: "0x123" } },
      setup: {
        components,
        systemCalls: { explorer_delete: vi.fn() },
      },
    });
    useComponentValueMock.mockImplementation((component) => {
      if (component === components.ExplorerTroops) return liveExplorer;
      if (component === components.Structure) return { owner: "0x123" };
      if (component === components.Resource) return { weight: { weight: 0n } };
      return undefined;
    });
    getStaminaMock.mockImplementation((troops: typeof baseTroops) => troops.stamina);
    getMaxStaminaMock.mockReturnValue(120);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("derives stamina from the current ExplorerTroops row", async () => {
    await act(async () => root.render(<Capture />));

    expect(captured?.stamina.amount).toBe(30n);
    expect(captured?.staminaDisplay?.displayCurrent).toBe(30);
    expect(captured?.maxStamina).toBe(120);
  });

  it("follows a same-tick spend in place without a Torii snapshot or remount", async () => {
    await act(async () => root.render(<Capture />));
    expect(captured?.staminaDisplay?.displayCurrent).toBe(30);

    liveExplorer = {
      ...liveExplorer,
      troops: { ...baseTroops, stamina: { amount: 0n, updated_tick: 5n } },
    };
    await act(async () => root.render(<Capture />));

    expect(captured?.stamina.amount).toBe(0n);
    expect(captured?.stamina.updated_tick).toBe(5n);
    expect(captured?.staminaDisplay?.displayCurrent).toBe(0);
  });
});
