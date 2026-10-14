import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { ResourceManager } from "@bibliothecadao/eternum";
import { AutomationUnavailable, readAutomationGameId, readTransferResources } from "./automation-readiness";
import { useTransferAutomationStore } from "@/hooks/store/use-transfer-automation-store";
import {
  useExplorationAutomationStore,
  DEFAULT_STRATEGY_ID,
  DEFAULT_SCOPE_RADIUS,
} from "@/hooks/store/use-exploration-automation-store";
import { useAutomationStore } from "@/hooks/store/use-automation-store";

const config = vi.hoisted(() => ({
  getSeasonConfig: vi.fn(),
  getResourceWeightKg: vi.fn(),
  getCapacityConfigKg: vi.fn(),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: config,
  getBlockTimestamp: () => ({ currentBlockTimestamp: 100 }),
}));
beforeEach(() => {
  config.getSeasonConfig.mockReset().mockReturnValue({ startSettlingAt: 10, startMainAt: 20, endAt: 30 });
  config.getResourceWeightKg.mockReset().mockReturnValue(1);
  config.getCapacityConfigKg.mockReset().mockReturnValue(10);
  useTransferAutomationStore.setState({ entries: {} });
  useExplorationAutomationStore.setState({ entries: {} });
});
const resources = (balance?: number) =>
  ({ balanceWithProduction: () => (balance === undefined ? undefined : { balance }) }) as unknown as ResourceManager;

describe("automation readiness", () => {
  it("preserves a synchronized zero balance as usable data", () => {
    expect(readTransferResources(resources(0), 1, [ResourcesIds.Wood])).toMatchObject({
      _tag: "Success",
      success: { donkeys: 0, capacity: 10 },
    });
    const result = readTransferResources(resources(2 * RESOURCE_PRECISION), 1, [ResourcesIds.Wood]);
    expect(result._tag).toBe("Success");
    if (result._tag === "Success") expect(result.success.balances.get(ResourcesIds.Wood)).toBe(2);
  });
  it("returns typed unavailability instead of partial or zeroed balances", () => {
    expect(readTransferResources(resources(), 1, [ResourcesIds.Wood])).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "AutomationUnavailable", message: "Wood balance is not synchronized." },
    });
  });
  it("requires both weights and carrying capacity, and recovers when config arrives", () => {
    config.getResourceWeightKg.mockReturnValueOnce(undefined);
    expect(readTransferResources(resources(10), 1, [ResourcesIds.Wood])).toMatchObject({
      _tag: "Failure",
      failure: { message: "Wood weight is not synchronized." },
    });
    config.getCapacityConfigKg.mockImplementationOnce(() => {
      throw new Error("missing capacity");
    });
    expect(readTransferResources(resources(10), 1, [ResourcesIds.Wood])).toMatchObject({
      _tag: "Failure",
      failure: { message: "Resource configuration is not ready for transfers." },
    });
    expect(readTransferResources(resources(10), 1, [ResourcesIds.Wood])._tag).toBe("Success");
  });
  it("does not create transfers or explorations under an unknown game", () => {
    config.getSeasonConfig.mockImplementation(() => {
      throw new Error("not synchronized");
    });
    expect(readAutomationGameId()).toMatchObject({ _tag: "Failure", failure: { _tag: "AutomationUnavailable" } });
    expect(() =>
      useTransferAutomationStore
        .getState()
        .add({ sourceEntityId: "1", destinationEntityId: "2", resourceIds: [ResourcesIds.Wood], intervalMinutes: 1 }),
    ).toThrow(AutomationUnavailable);
    expect(() =>
      useExplorationAutomationStore
        .getState()
        .add({ explorerId: "1", active: true, scopeRadius: DEFAULT_SCOPE_RADIUS, strategyId: DEFAULT_STRATEGY_ID }),
    ).toThrow(AutomationUnavailable);
    expect(useTransferAutomationStore.getState().entries).toEqual({});
    expect(useExplorationAutomationStore.getState().entries).toEqual({});
  });
  it("drops persisted entries with unknown or missing game identity without relabeling them", async () => {
    for (const store of [useTransferAutomationStore, useExplorationAutomationStore]) {
      const migrate = store.persist.getOptions().migrate!;
      const result = await migrate(
        { entries: { missing: {}, unknown: { gameId: "unknown" }, known: { gameId: "10-20-30" } } },
        0,
      );
      expect(Object.keys((result as { entries: object }).entries)).toEqual(["known"]);
    }
  });
  it("keeps production explicitly unready before config and preserves known saved identity until pruning", async () => {
    expect(useAutomationStore.getInitialState().gameId).toBeNull();
    config.getSeasonConfig.mockImplementation(() => {
      throw new Error("not synchronized");
    });
    const migrate = useAutomationStore.persist.getOptions().migrate!;
    expect(await migrate({ gameId: "unknown", realms: {} }, 9)).toEqual({
      gameId: null,
      realms: {},
      nextRunTimestamp: null,
    });
    expect(await migrate({ gameId: "10-20-30", realms: {} }, 9)).toEqual({
      gameId: "10-20-30",
      realms: {},
      nextRunTimestamp: null,
    });
    useAutomationStore.getState().pruneForGame("40-50-60");
    expect(useAutomationStore.getState().gameId).toBe("40-50-60");
  });
});
