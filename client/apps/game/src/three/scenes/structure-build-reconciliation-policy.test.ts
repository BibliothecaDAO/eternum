import { describe, expect, it, vi } from "vitest";
import {
  type StructureBuildReconciliationSubscriptionState,
  ensureStructureBuildReconciliationSubscription,
} from "./structure-build-reconciliation-policy";

const BUILDING_TYPE_WHEAT = 1;

describe("ensureStructureBuildReconciliationSubscription", () => {
  it("subscribes once and reconciles structure building updates", () => {
    const state: StructureBuildReconciliationSubscriptionState = {
      hasSubscribed: false,
    };

    let subscriptionCallback:
      | ((value: { entityId: number; activeProductions: Array<{ buildingType: number; buildingCount: number }> }) => void)
      | undefined;

    const subscribe = vi.fn((callback: typeof subscriptionCallback) => {
      subscriptionCallback = callback;
    });
    const reconcile = vi.fn();

    const firstAttempt = ensureStructureBuildReconciliationSubscription({
      state,
      subscribe,
      reconcile,
    });

    expect(firstAttempt).toBe(true);
    expect(subscribe).toHaveBeenCalledTimes(1);

    subscriptionCallback?.({
      entityId: 777,
      activeProductions: [{ buildingType: BUILDING_TYPE_WHEAT, buildingCount: 2 }],
    });

    expect(reconcile).toHaveBeenCalledWith(777, [{ buildingType: BUILDING_TYPE_WHEAT, buildingCount: 2 }]);

    const secondAttempt = ensureStructureBuildReconciliationSubscription({
      state,
      subscribe,
      reconcile,
    });

    expect(secondAttempt).toBe(false);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
