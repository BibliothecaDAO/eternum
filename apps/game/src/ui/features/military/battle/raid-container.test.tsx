// @vitest-environment jsdom

import { act, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RaidContainer } from "./raid-container";

const mocks = vi.hoisted(() => ({
  currentArmiesTick: 2,
  getArmy: vi.fn(() => ({
    totalCapacity: 100,
    troops: {
      count: 1000n,
      category: 1,
      tier: 1,
      stamina: {
        amount: 0n,
        updated_tick: 0n,
      },
      battle_cooldown_end: 0,
    },
  })),
  getStamina: vi.fn((_troops: unknown, currentArmiesTick: number) => ({
    amount: BigInt(currentArmiesTick * 10),
    updated_tick: BigInt(currentArmiesTick),
  })),
  getComponentValue: vi.fn(() => ({
    balances: {},
  })),
  raidExplorerVsGuard: vi.fn(async () => undefined),
  updateSelectedEntityId: vi.fn(),
}));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentArmiesTick: () => mocks.currentArmiesTick,
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (
    selector: (state: {
      selectedHex: { col: number; row: number };
      updateEntityActionSelectedEntityId: typeof mocks.updateSelectedEntityId;
    }) => unknown,
  ) =>
    selector({
      selectedHex: { col: 10, row: 10 },
      updateEntityActionSelectedEntityId: mocks.updateSelectedEntityId,
    }),
}));

vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({
    children,
    isLoading: _isLoading,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/ui/design-system/atoms", () => ({
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/ui/design-system/molecules/resource-icon", () => ({
  ResourceIcon: () => <span data-testid="resource-icon" />,
}));

vi.mock("@/ui/features", () => ({
  BiomeInfoPanel: () => <div>Biome Info</div>,
}));

vi.mock("../../world/components/entities/active-relic-effects", () => ({
  ActiveRelicEffects: () => null,
}));

vi.mock("./raid-result", () => ({
  RaidResult: () => <div>Raid Result</div>,
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    account: {
      account: {
        address: "0x123",
      },
    },
    setup: {
      systemCalls: {
        raid_explorer_vs_guard: mocks.raidExplorerVsGuard,
      },
      components: {
        Resource: Symbol("Resource"),
      },
    },
  }),
}));

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: mocks.getComponentValue,
}));

vi.mock("@bibliothecadao/eternum", () => ({
  Biome: {
    getBiome: () => "forest",
  },
  CombatSimulator: class CombatSimulator {
    calculateStaminaModifier() {
      return 1;
    }
  },
  RaidSimulator: class RaidSimulator {
    simulateRaid() {
      return {
        successChance: 100,
        raiderDamageTaken: 0,
        defenderDamageTaken: 0,
        damageTakenPerDefender: [0],
      };
    }
  },
  configManager: {
    getBiome: () => "forest",
    getCombatConfig: () => ({
      stamina_attack_req: 50,
    }),
    getBiomeCombatBonus: () => 0,
    getCapacityConfigKg: () => 1,
    getResourceWeightKg: () => 1,
  },
  divideByPrecision: (value: number) => value,
  getArmy: mocks.getArmy,
  getEntityIdFromKeys: () => "entity",
  getRemainingCapacityInKg: () => 100,
  StaminaManager: {
    getStamina: mocks.getStamina,
  },
}));

describe("RaidContainer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.currentArmiesTick = 2;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("refreshes attacker stamina when the armies tick advances without a refetch", async () => {
    const target = {
      info: [
        {
          count: 500n,
          category: 1,
          tier: 1,
          stamina: { amount: 30n, updated_tick: 2n },
          battle_cooldown_end: 0,
        },
      ],
      id: 2,
      targetType: 0,
      structureCategory: 1,
      hex: { x: 11, y: 10 },
      addressOwner: null,
    };

    await act(async () => {
      root.render(
        <RaidContainer
          attackerEntityId={1 as never}
          target={target as never}
          targetResources={[{ resourceId: 1, amount: 10 }]}
          attackerActiveRelicEffects={[]}
          targetActiveRelicEffects={[]}
        />,
      );
    });

    expect(container.textContent).toContain("20 / 50 required");

    mocks.currentArmiesTick = 6;

    await act(async () => {
      root.render(
        <RaidContainer
          attackerEntityId={1 as never}
          target={target as never}
          targetResources={[{ resourceId: 1, amount: 10 }]}
          attackerActiveRelicEffects={[]}
          targetActiveRelicEffects={[]}
        />,
      );
    });

    expect(container.textContent).toContain("60 / 50 required");
  });
});
