// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CombatContainer } from "./combat-container";

const mocks = vi.hoisted(() => ({
  account: { address: "0x123" },
  attackExplorerVsExplorer: vi.fn(async () => undefined),
  attackExplorerVsGuard: vi.fn(async () => undefined),
  attackGuardVsExplorer: vi.fn(async () => undefined),
  closeAttackDrawer: vi.fn(),
  toriiClient: {},
  components: {
    Structure: Symbol("Structure"),
    ExplorerTroops: Symbol("ExplorerTroops"),
    Resource: Symbol("Resource"),
  },
  targetTile: {
    occupier_id: 2,
    occupier_is_structure: false,
    col: 12,
    row: 10,
  },
  guards: [
    {
      slot: 0,
      troops: {
        count: 100n,
        category: "Knight",
        tier: "T1",
        stamina: { amount: 30n, updated_tick: 1n },
        battle_cooldown_end: 0,
      },
    },
    {
      slot: 1,
      troops: {
        count: 100n,
        category: "Crossbowman",
        tier: "T1",
        stamina: { amount: 30n, updated_tick: 1n },
        battle_cooldown_end: 0,
      },
    },
  ],
  targetTroops: {
    count: 100n,
    category: "Knight",
    tier: "T1",
    stamina: { amount: 30n, updated_tick: 1n },
    battle_cooldown_end: 0,
  },
}));

vi.mock("@/shared/store", () => ({
  useStore: (selector: (state: unknown) => unknown) =>
    selector({
      selectedHex: { col: 10, row: 10 },
      closeAttackDrawer: mocks.closeAttackDrawer,
    }),
}));

vi.mock("@/shared/ui/badge", () => ({
  Badge: ({ children }: React.HTMLAttributes<HTMLSpanElement>) => <span>{children}</span>,
}));

vi.mock("@/shared/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/shared/ui/card", () => ({
  Card: ({ children }: React.HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  CardContent: ({ children }: React.HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  CardHeader: ({ children }: React.HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  CardTitle: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => <h3>{children}</h3>,
}));

vi.mock("@/shared/ui/resource-icon", () => ({
  ResourceIcon: () => <span data-testid="resource-icon" />,
}));

vi.mock("@/shared/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("lucide-react/dist/esm/icons/loader-2", () => ({
  default: () => <span data-testid="loader" />,
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    account: { account: mocks.account },
    setup: {
      systemCalls: {
        attack_explorer_vs_explorer: mocks.attackExplorerVsExplorer,
        attack_explorer_vs_guard: mocks.attackExplorerVsGuard,
        attack_guard_vs_explorer: mocks.attackGuardVsExplorer,
      },
      components: mocks.components,
    },
    network: { toriiClient: mocks.toriiClient },
  }),
}));

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: symbol, entity: string) => {
    if (component === mocks.components.Structure && entity === "1") {
      return { category: "Realm", owner: 0x123n, troop_guards: {} };
    }
    if (component === mocks.components.ExplorerTroops && entity === "2") {
      return { troops: mocks.targetTroops };
    }
    if (component === mocks.components.Resource) {
      return {};
    }
    return undefined;
  },
}));

vi.mock("@bibliothecadao/eternum", () => ({
  Biome: {
    getBiome: () => "forest",
  },
  CombatSimulator: class CombatSimulator {
    simulateBattleWithParams() {
      return {
        attackerDamage: 0,
        defenderDamage: 0,
      };
    }
  },
  configManager: {
    getCombatConfig: () => ({ stamina_attack_req: 30 }),
    getCapacityConfigKg: () => 1,
    getResourceWeightKg: () => 1,
  },
  DEFAULT_COORD_ALT: false,
  divideByPrecision: (value: number) => value,
  getArmy: () => undefined,
  getBlockTimestamp: () => ({ currentArmiesTick: 1 }),
  getEntityIdFromKeys: (keys: bigint[]) => keys.map((key) => key.toString()).join(":"),
  getGuardsByStructure: () => mocks.guards,
  getRemainingCapacityInKg: () => 100,
  getTileAt: () => mocks.targetTile,
  StaminaManager: class StaminaManager {
    static getStamina(troops: { stamina: { amount: bigint; updated_tick: bigint } }) {
      return troops.stamina;
    }
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  CapacityConfig: {
    Army: "Army",
  },
  getHexDistance: () => 2,
  getTroopAttackRange: (troopType: string) => (troopType === "Crossbowman" ? 2 : 1),
  RESOURCE_PRECISION: 1,
  resources: [],
  STEALABLE_RESOURCES: [],
  StructureType: {
    Village: "Village",
  },
  TroopTier: {
    T1: "T1",
  },
  TroopType: {
    Knight: "Knight",
    Crossbowman: "Crossbowman",
    Paladin: "Paladin",
  },
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("Mobile CombatContainer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    mocks.attackGuardVsExplorer.mockClear();
    mocks.closeAttackDrawer.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("uses an in-range guard when a structure attacks a radius-two target", async () => {
    await act(async () => {
      root.render(<CombatContainer attackerEntityId={1 as never} targetHex={{ x: 12, y: 10 }} />);
      await waitForAsyncWork();
    });

    const attackButton = Array.from(container.querySelectorAll("button")).find((button) =>
      /attack/i.test(button.textContent ?? ""),
    ) as HTMLButtonElement | undefined;

    expect(attackButton).toBeDefined();
    expect(attackButton?.disabled).toBe(false);

    await act(async () => {
      attackButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.attackGuardVsExplorer).toHaveBeenCalledWith(
      expect.objectContaining({
        structure_guard_slot: 1,
      }),
    );
  });
});
