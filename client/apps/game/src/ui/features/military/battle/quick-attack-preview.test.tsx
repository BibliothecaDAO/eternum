// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QuickAttackPreview } from "./quick-attack-preview";

const mocks = vi.hoisted(() => ({
  account: { address: "0x123", name: "Tester" },
  attackExplorerVsExplorer: vi.fn(async () => undefined),
  attackExplorerVsGuard: vi.fn(async () => undefined),
  attackGuardVsExplorer: vi.fn(async () => undefined),
  playUnitCommandSound: vi.fn(),
  toggleModal: vi.fn(),
  updateSelectedEntityId: vi.fn(),
  dispatchPendingWorldmapFxStart: vi.fn(),
  dispatchPendingWorldmapFxStop: vi.fn(),
  components: {
    Structure: Symbol("Structure"),
    ExplorerTroops: Symbol("ExplorerTroops"),
  },
  attackerTroops: {
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
  attackerStamina: {
    amount: 0n,
    updated_tick: 0n,
  },
  quickAttackTargetData: {
    attackerRelicEffects: [],
    targetRelicEffects: [],
    target: {
      info: [],
      id: 2,
      targetType: 0,
      structureCategory: null,
      hex: { x: 11, y: 10 },
      addressOwner: null,
    },
    targetResources: [],
    isLoading: false,
  },
}));

vi.mock("@/audio/unit-command-audio", () => ({
  playUnitCommandSound: mocks.playUnitCommandSound,
}));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useBlockTimestamp: () => ({
    currentArmiesTick: 1,
    armiesTickTimeRemaining: 0,
  }),
}));

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (selector: (state: { accountName: string }) => unknown) =>
    selector({ accountName: "Test Commander" }),
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (
    selector: (state: {
      selectedHex: { col: number; row: number };
      toggleModal: typeof mocks.toggleModal;
      updateEntityActionSelectedEntityId: typeof mocks.updateSelectedEntityId;
    }) => unknown,
  ) =>
    selector({
      selectedHex: { col: 10, row: 10 },
      toggleModal: mocks.toggleModal,
      updateEntityActionSelectedEntityId: mocks.updateSelectedEntityId,
    }),
}));

vi.mock("@/utils/pending-worldmap-fx", () => ({
  createPendingWorldmapFxKey: () => "attack-preview-fx",
  dispatchPendingWorldmapFxStart: mocks.dispatchPendingWorldmapFxStart,
  dispatchPendingWorldmapFxStop: mocks.dispatchPendingWorldmapFxStop,
}));

vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({
    children,
    forceUppercase: _forceUppercase,
    isLoading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { forceUppercase?: boolean; isLoading?: boolean }) => (
    <button type="button" {...props}>
      {isLoading ? "Loading" : children}
    </button>
  ),
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    account: {
      account: mocks.account,
    },
    setup: {
      systemCalls: {
        attack_explorer_vs_explorer: mocks.attackExplorerVsExplorer,
        attack_explorer_vs_guard: mocks.attackExplorerVsGuard,
        attack_guard_vs_explorer: mocks.attackGuardVsExplorer,
      },
      components: mocks.components,
    },
  }),
}));

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: symbol) => {
    if (component === mocks.components.Structure) {
      return undefined;
    }

    if (component === mocks.components.ExplorerTroops) {
      return {
        troops: mocks.attackerTroops,
      };
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
    getCombatConfig: () => ({
      stamina_attack_req: 50,
    }),
    getRefillPerTick: () => 20,
    getTick: () => 60,
  },
  DEFAULT_COORD_ALT: false,
  formatTime: (seconds: number) => `${seconds}s`,
  getEntityIdFromKeys: () => "entity",
  getGuardsByStructure: () => [],
  StaminaManager: class StaminaManager {
    constructor(_components: unknown, _entityId: number) {}

    getStamina() {
      return mocks.attackerStamina;
    }
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  ActorType: {
    Explorer: "explorer",
    Structure: "structure",
  },
  getDirectionBetweenAdjacentHexes: () => 0,
  RESOURCE_PRECISION: 1,
  TickIds: {
    Armies: "armies",
  },
}));

vi.mock("./hooks/use-attack-target", () => ({
  useAttackTargetData: () => mocks.quickAttackTargetData,
}));

vi.mock("./combat-modal", () => ({
  CombatModal: () => <div data-testid="combat-modal">Combat Modal</div>,
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const findPrimaryActionButton = (container: HTMLElement) => {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    /(attack|claim|need .* stamina|on cooldown|no troops selected)/i.test(button.textContent ?? ""),
  ) as HTMLButtonElement | undefined;
};

describe("QuickAttackPreview", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    mocks.attackerStamina = {
      amount: 0n,
      updated_tick: 0n,
    };
    mocks.quickAttackTargetData = {
      attackerRelicEffects: [],
      targetRelicEffects: [],
      target: {
        info: [],
        id: 2,
        targetType: 0,
        structureCategory: null,
        hex: { x: 11, y: 10 },
        addressOwner: null,
      },
      targetResources: [],
      isLoading: false,
    };

    mocks.attackExplorerVsExplorer.mockClear();
    mocks.attackExplorerVsGuard.mockClear();
    mocks.attackGuardVsExplorer.mockClear();
    mocks.playUnitCommandSound.mockClear();
    mocks.toggleModal.mockClear();
    mocks.updateSelectedEntityId.mockClear();
    mocks.dispatchPendingWorldmapFxStart.mockClear();
    mocks.dispatchPendingWorldmapFxStop.mockClear();
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

  it("disables unguarded structure claims when stamina is below the required threshold", async () => {
    await act(async () => {
      root.render(
        <QuickAttackPreview
          attacker={{ type: "explorer" as never, id: 1 as never, hex: { x: 10, y: 10 } }}
          target={{ type: "structure" as never, id: 2 as never, hex: { x: 11, y: 10 } }}
        />,
      );
      await waitForAsyncWork();
    });

    const actionButton = findPrimaryActionButton(container);

    expect(actionButton).toBeDefined();
    expect(actionButton?.disabled).toBe(true);

    await act(async () => {
      actionButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.attackExplorerVsGuard).not.toHaveBeenCalled();
  });

  it("still allows structure claims once stamina reaches the required threshold", async () => {
    mocks.attackerStamina = {
      amount: 50n,
      updated_tick: 1n,
    };

    await act(async () => {
      root.render(
        <QuickAttackPreview
          attacker={{ type: "explorer" as never, id: 1 as never, hex: { x: 10, y: 10 } }}
          target={{ type: "structure" as never, id: 2 as never, hex: { x: 11, y: 10 } }}
        />,
      );
      await waitForAsyncWork();
    });

    const actionButton = findPrimaryActionButton(container);

    expect(actionButton).toBeDefined();
    expect(actionButton?.disabled).toBe(false);

    await act(async () => {
      actionButton?.click();
      await waitForAsyncWork();
    });

    expect(mocks.attackExplorerVsGuard).toHaveBeenCalledTimes(1);
  });
});
