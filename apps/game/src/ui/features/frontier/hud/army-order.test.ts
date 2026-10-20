import { describe, expect, it, vi } from "vitest";

// The selected army (7) has pinned an explore of the tile (1, 2); its realm's wheat is what the test holds.
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: { get: () => ({ owner: 1n, troops: {} }) } } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 1 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (select: (state: unknown) => unknown) =>
    select({ entityActions: { selectedEntityId: 7, actionPaths: new Map([["tile", [{}, {}]]]) } }),
}));
vi.mock("@/three/scenes/worldmap-order-request", () => ({ pinsOrder: () => true }));
vi.mock("@/lib/army-stamina/path-cost", () => ({ computeEffectiveStaminaCost: () => 21 }));
// QA's charge: 563 troops at 0.05 wheat a step.
vi.mock("./order-tip", () => ({ orderFood: () => ({ wheat: 28.15, fish: 0 }) }));
vi.mock("@bibliothecadao/eternum/troop-stamina", () => ({ resolveExplorerTroops: () => ({}) }));
const realm = vi.hoisted(() => ({ wheat: 0 }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bibliothecadao/eternum")>();
  return {
    ...actual,
    ActionPaths: { posKey: () => "tile", getActionType: () => actual.ActionType.Explore },
    configManager: { getActiveGameId: () => 1, getExploreStaminaCost: () => 21 },
    // The balance as the chain stores it, at the resource's precision.
    getBalance: () => ({ balance: Math.round(realm.wheat * 1_000_000_000) }),
    ResourceManager: class {
      wheatPerHour() {
        return 60;
      }
    },
    StaminaManager: { getStamina: () => ({ amount: 120n }) },
  };
});

import { isCovered, useOrderAt } from "./army-order";

const orderWith = (wheat: number) => {
  realm.wheat = wheat;
  return useOrderAt({ col: 1, row: 2 })!.wheat;
};

describe("an order's wheat, held exactly against its charge", () => {
  it.each([28.15, 28.2, 28.99])("covers a 28.15 charge with %s held, and waits for nothing", (held) => {
    const wheat = orderWith(held);
    expect(wheat.held).toBeCloseTo(held, 9);
    expect(isCovered(wheat)).toBe(true);
    expect(wheat.wait).toBeUndefined();
  });

  it("refuses it with 28.1 held, and waits the farms' 3 seconds for the 0.05 missing", () => {
    const wheat = orderWith(28.1);
    expect(isCovered(wheat)).toBe(false);
    expect(wheat.wait).toBeCloseTo(3, 6);
  });
});
