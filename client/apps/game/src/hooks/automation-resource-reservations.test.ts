// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { PROCESS_INTERVAL_MS } from "@/ui/features/infrastructure/automation/model/automation-processor";
import {
  applyAutomationReservationsToSnapshot,
  clearAutomationResourceReservationsForTests,
  getSpendableResourceBalance,
  releaseAutomationReservation,
  reserveAutomationResources,
} from "./automation-resource-reservations";

describe("automation resource reservations", () => {
  afterEach(() => {
    clearAutomationResourceReservationsForTests();
  });

  it("subtracts pending same-entity resource spend from spendable balances", () => {
    reserveAutomationResources({
      entityId: 42,
      resources: [{ resourceId: ResourcesIds.Wood, humanAmount: 60 }],
      nowMs: 1_000,
      ttlMs: 10_000,
    });

    expect(
      getSpendableResourceBalance({
        entityId: 42,
        resourceId: ResourcesIds.Wood,
        balanceHuman: 100,
        nowMs: 2_000,
      }),
    ).toBe(40);
  });

  it("keeps unrelated entities and resources independent", () => {
    reserveAutomationResources({
      entityId: 42,
      resources: [{ resourceId: ResourcesIds.Wood, humanAmount: 60 }],
      nowMs: 1_000,
      ttlMs: 10_000,
    });

    expect(
      getSpendableResourceBalance({
        entityId: 43,
        resourceId: ResourcesIds.Wood,
        balanceHuman: 100,
        nowMs: 2_000,
      }),
    ).toBe(100);
    expect(
      getSpendableResourceBalance({
        entityId: 42,
        resourceId: ResourcesIds.Coal,
        balanceHuman: 100,
        nowMs: 2_000,
      }),
    ).toBe(100);
  });

  it("removes reservations when they expire or are released after a failed submit", () => {
    const token = reserveAutomationResources({
      entityId: 42,
      resources: [{ resourceId: ResourcesIds.Wood, humanAmount: 60 }],
      nowMs: 1_000,
      ttlMs: 1_000,
    });

    expect(
      getSpendableResourceBalance({
        entityId: 42,
        resourceId: ResourcesIds.Wood,
        balanceHuman: 100,
        nowMs: 2_001,
      }),
    ).toBe(100);

    const secondToken = reserveAutomationResources({
      entityId: 42,
      resources: [{ resourceId: ResourcesIds.Wood, humanAmount: 25 }],
      nowMs: 3_000,
      ttlMs: 10_000,
    });

    releaseAutomationReservation(secondToken);
    releaseAutomationReservation(token);

    expect(
      getSpendableResourceBalance({
        entityId: 42,
        resourceId: ResourcesIds.Wood,
        balanceHuman: 100,
        nowMs: 4_000,
      }),
    ).toBe(100);
  });

  it("applies reservations to production snapshots without mutating the original snapshot", () => {
    reserveAutomationResources({
      entityId: 42,
      resources: [{ resourceId: ResourcesIds.Wood, humanAmount: 60 }],
      nowMs: 1_000,
      ttlMs: 10_000,
    });

    const snapshot = new Map([
      [
        ResourcesIds.Wood,
        {
          resourceId: ResourcesIds.Wood,
          balanceHuman: 100,
          hasActiveProduction: true,
          productionPerSecond: 1,
        },
      ],
    ]);

    const adjusted = applyAutomationReservationsToSnapshot({
      entityId: 42,
      snapshot,
      nowMs: 2_000,
    });

    expect(adjusted.get(ResourcesIds.Wood)?.balanceHuman).toBe(40);
    expect(snapshot.get(ResourcesIds.Wood)?.balanceHuman).toBe(100);
  });

  it("expires default reservations before the next automation pass", () => {
    reserveAutomationResources({
      entityId: 42,
      resources: [{ resourceId: ResourcesIds.Wood, humanAmount: 60 }],
      nowMs: 1_000,
    });

    expect(
      getSpendableResourceBalance({
        entityId: 42,
        resourceId: ResourcesIds.Wood,
        balanceHuman: 100,
        nowMs: 1_000 + PROCESS_INTERVAL_MS,
      }),
    ).toBe(100);
  });
});
