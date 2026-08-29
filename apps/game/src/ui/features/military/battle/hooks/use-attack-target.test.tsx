import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAttackTargetData } from "./use-attack-target";

const { useComponentValueMock, getResourceBalancesMock } = vi.hoisted(() => ({
  useComponentValueMock: vi.fn(),
  getResourceBalancesMock: vi.fn(),
}));

const components = {
  Structure: Symbol("Structure"),
  ExplorerTroops: Symbol("ExplorerTroops"),
  ProductionBoostBonus: Symbol("ProductionBoostBonus"),
  Resource: Symbol("Resource"),
  TileOpt: Symbol("TileOpt"),
};

let targetExplorer = createExplorer(1_000n);
let targetResource = { version: 1 };

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({ setup: { components } }),
}));
vi.mock("@dojoengine/react", () => ({ useComponentValue: useComponentValueMock }));
vi.mock("@/sync/game-scope", () => ({
  gameEntityKey: (keys: bigint[]) => `entity:${keys.join(":")}`,
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useBlockTimestamp: () => ({ currentBlockTimestamp: 60, currentArmiesTick: 2 }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  DEFAULT_COORD_ALT: false,
  getArmyRelicEffects: vi.fn(() => []),
  getGuardsByStructure: vi.fn(() => []),
  getStructureArmyRelicEffects: vi.fn(() => []),
  getStructureRelicEffects: vi.fn(() => []),
  tileOptToTile: vi.fn(() => ({
    occupier_id: 321,
    occupier_is_structure: false,
    col: 10,
    row: 12,
  })),
  ResourceManager: {
    getResourceBalances: getResourceBalancesMock,
    getResourceBalancesWithProduction: vi.fn(() => []),
  },
  StaminaManager: {
    getStamina: vi.fn((troops) => troops.stamina),
  },
}));
vi.mock("@bibliothecadao/types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/types")>()),
  ContractAddress: (value: bigint) => value,
  STEALABLE_RESOURCES: [1],
}));

function createExplorer(count: bigint) {
  return {
    owner: 99,
    troops: {
      count,
      category: 1,
      tier: 1,
      stamina: { amount: count, updated_tick: 2n },
      boosts: {},
      battle_cooldown_end: 0,
    },
  };
}

let latestResult: ReturnType<typeof useAttackTargetData> | null = null;

function HookHarness() {
  latestResult = useAttackTargetData(1 as never, { x: 5, y: 6 });
  return null;
}

describe("useAttackTargetData live RECS target", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestResult = null;
    targetExplorer = createExplorer(1_000n);
    targetResource = { version: 1 };
    useComponentValueMock.mockImplementation((component, entity) => {
      if (component === components.TileOpt) return {};
      if (component === components.ExplorerTroops && entity === "entity:321") return targetExplorer;
      if (component === components.Structure && entity === "entity:99") return { owner: 123n };
      if (component === components.Resource && entity === "entity:321") return targetResource;
      return undefined;
    });
    getResourceBalancesMock.mockImplementation((resource) => [{ resourceId: 1, amount: resource.version * 10 }]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("updates troops, stamina, and stealable resources while the preview remains mounted", async () => {
    await act(async () => root.render(<HookHarness />));

    expect(latestResult?.target?.info[0]?.count).toBe(1_000n);
    expect(latestResult?.target?.info[0]?.stamina.amount).toBe(1_000n);
    expect(latestResult?.targetResources).toEqual([{ resourceId: 1, amount: 10 }]);

    targetExplorer = createExplorer(400n);
    targetResource = { version: 2 };
    await act(async () => root.render(<HookHarness />));

    expect(latestResult?.target?.info[0]?.count).toBe(400n);
    expect(latestResult?.target?.info[0]?.stamina.amount).toBe(400n);
    expect(latestResult?.targetResources).toEqual([{ resourceId: 1, amount: 20 }]);
  });
});
