// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@dojoengine/sdk", () => ({
  AndComposeClause: vi.fn(() => ({
    build: () => ({ mocked: true }),
  })),
  MemberClause: vi.fn(),
}));

vi.mock("@dojoengine/torii-client", () => ({
  PatternMatching: {},
}));

const envMock = vi.hoisted(() => ({
  env: {
    VITE_PUBLIC_TORII_SPATIAL_SUBSCRIPTION_UPDATE_ENABLED: true,
  },
}));

vi.mock("../../env", () => envMock);

vi.mock("./sync", () => ({
  syncEntitiesDebounced: vi.fn(),
}));

const { addToriiStreamBreadcrumbMock, reportToriiReadinessTimeoutMock, reportToriiSubscriptionLifecycleMock } =
  vi.hoisted(() => ({
    addToriiStreamBreadcrumbMock: vi.fn(),
    reportToriiReadinessTimeoutMock: vi.fn(),
    reportToriiSubscriptionLifecycleMock: vi.fn(),
  }));

vi.mock("@/observability/network-health-reporting", () => ({
  addToriiStreamBreadcrumb: addToriiStreamBreadcrumbMock,
  reportToriiReadinessTimeout: reportToriiReadinessTimeoutMock,
  reportToriiSubscriptionLifecycle: reportToriiSubscriptionLifecycleMock,
}));

import { syncEntitiesDebounced } from "./sync";
import { ToriiStreamManager, type BoundsDescriptor } from "./torii-stream-manager";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type SyncSubscriptionStub = {
  cancel: () => void;
  ready: Promise<void>;
  updateClause?: (clause: unknown) => Promise<void>;
};

const syncSubscription = (
  cancel: () => void,
  ready: Promise<void> = Promise.resolve(),
  updateClause?: (clause: unknown) => Promise<void>,
): SyncSubscriptionStub => ({
  cancel,
  ready,
  updateClause,
});

const descriptor = (minCol: number): BoundsDescriptor => ({
  minCol,
  maxCol: minCol + 10,
  minRow: 0,
  maxRow: 10,
  models: [{ model: "s1_eternum-TileOpt", colField: "col", rowField: "row" }],
});

describe("ToriiStreamManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.env.VITE_PUBLIC_TORII_SPATIAL_SUBSCRIPTION_UPDATE_ENABLED = true;
  });

  it("reports skipped outcome when switching to an unchanged signature", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const cancel = vi.fn();
    syncMock.mockImplementation(async () => syncSubscription(cancel));

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
    });

    const first = await manager.switchBounds(descriptor(0));
    const second = await manager.switchBounds(descriptor(0));

    expect(first.outcome).toBe("applied");
    expect(second.outcome).toBe("skipped_same_signature");
    expect(syncMock).toHaveBeenCalledTimes(1);
  });

  it("updates the active spatial subscription instead of recreating it when bounds change", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const updateClause = vi.fn(async () => undefined);
    const cancel = vi.fn();
    syncMock.mockImplementation(async () => syncSubscription(cancel, Promise.resolve(), updateClause));

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
    });

    const first = await manager.switchBounds(descriptor(0));
    const second = await manager.switchBounds(descriptor(24));

    manager.cancelCurrentSubscription();

    expect(first.outcome).toBe("applied");
    expect(second.outcome).toBe("applied");
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(updateClause).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("falls back to recreating the spatial subscription when an update fails", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const updateClause = vi.fn(async () => {
      throw new Error("update failed");
    });
    const cancelOld = vi.fn();
    const cancelFresh = vi.fn();
    syncMock
      .mockImplementationOnce(async () => syncSubscription(cancelOld, Promise.resolve(), updateClause))
      .mockImplementationOnce(async () => syncSubscription(cancelFresh));

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
    });

    await manager.switchBounds(descriptor(0));
    const second = await manager.switchBounds(descriptor(24));

    manager.cancelCurrentSubscription();

    expect(second.outcome).toBe("applied");
    expect(updateClause).toHaveBeenCalledTimes(1);
    expect(syncMock).toHaveBeenCalledTimes(2);
    expect(cancelOld).toHaveBeenCalledTimes(1);
    expect(cancelFresh).toHaveBeenCalledTimes(1);
  });

  it("reports fallback recreate failure and leaves the old subscription live", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const updateClause = vi.fn(async () => {
      throw new Error("update failed");
    });
    const cancelOld = vi.fn();
    syncMock
      .mockImplementationOnce(async () => syncSubscription(cancelOld, Promise.resolve(), updateClause))
      .mockRejectedValueOnce(new Error("recreate failed"));

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
    });

    await manager.switchBounds(descriptor(0));

    await expect(manager.switchBounds(descriptor(24))).rejects.toThrow("recreate failed");

    expect(cancelOld).not.toHaveBeenCalled();
    expect(reportToriiSubscriptionLifecycleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        streamType: "spatial",
        kind: "fallback_recreate",
        outcome: "failed",
        requestId: 2,
        reason: "recreate failed",
      }),
    );

    manager.cancelCurrentSubscription();
  });

  it("uses the recreate path when spatial subscription updates are disabled", async () => {
    envMock.env.VITE_PUBLIC_TORII_SPATIAL_SUBSCRIPTION_UPDATE_ENABLED = false;
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const updateClause = vi.fn(async () => undefined);
    const cancelFirst = vi.fn();
    const cancelSecond = vi.fn();
    syncMock
      .mockImplementationOnce(async () => syncSubscription(cancelFirst, Promise.resolve(), updateClause))
      .mockImplementationOnce(async () => syncSubscription(cancelSecond));

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
    });

    await manager.switchBounds(descriptor(0));
    const second = await manager.switchBounds(descriptor(24));

    manager.cancelCurrentSubscription();

    expect(second.outcome).toBe("applied");
    expect(updateClause).not.toHaveBeenCalled();
    expect(syncMock).toHaveBeenCalledTimes(2);
    expect(cancelFirst).toHaveBeenCalledTimes(1);
    expect(cancelSecond).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest bounds subscription active when switches race", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const firstSwitch = deferred<SyncSubscriptionStub>();
    const secondSwitch = deferred<SyncSubscriptionStub>();

    const cancelFirst = vi.fn();
    const cancelSecond = vi.fn();

    syncMock
      .mockImplementationOnce(async () => firstSwitch.promise)
      .mockImplementationOnce(async () => secondSwitch.promise);

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
    });

    const pendingFirst = manager.switchBounds(descriptor(0));
    const pendingSecond = manager.switchBounds(descriptor(24));

    // Resolve second first to simulate out-of-order completion.
    secondSwitch.resolve(syncSubscription(cancelSecond));
    await Promise.resolve();

    firstSwitch.resolve(syncSubscription(cancelFirst));

    const [firstResult, secondResult] = await Promise.all([pendingFirst, pendingSecond]);

    manager.cancelCurrentSubscription();

    expect(firstResult.outcome).toBe("stale_dropped");
    expect(secondResult.outcome).toBe("applied");
    expect(cancelFirst).toHaveBeenCalledTimes(1);
    expect(cancelSecond).toHaveBeenCalledTimes(1);
  });

  it("applies bounds while monitoring spatial TileOpt readiness in the background", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const ready = deferred<void>();
    const cancel = vi.fn();
    const onSpatialReadyTimeout = vi.fn();
    syncMock.mockImplementation(async () => syncSubscription(cancel, ready.promise));

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
      onSpatialReadyTimeout,
    });

    const result = await manager.switchBounds(descriptor(0));
    ready.resolve();
    await Promise.resolve();

    manager.cancelCurrentSubscription();

    expect(result.outcome).toBe("applied");
    expect(onSpatialReadyTimeout).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("reports spatial TileOpt readiness timeout without blocking bounds application", async () => {
    vi.useFakeTimers();
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const onSpatialReadyTimeout = vi.fn();
    const cancel = vi.fn();
    syncMock.mockImplementation(async () => syncSubscription(cancel, new Promise<void>(() => {})));

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
      onSpatialReadyTimeout,
      subscriptionSetupTimeoutMs: 25,
    });

    const result = await manager.switchBounds(descriptor(0));

    expect(result.outcome).toBe("applied");
    expect(onSpatialReadyTimeout).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(25);

    expect(onSpatialReadyTimeout).toHaveBeenCalledWith({
      elapsedMs: expect.any(Number),
      requestId: 1,
      timeoutMs: 25,
    });

    manager.cancelCurrentSubscription();
    vi.useRealTimers();
  });

  it("uses in-bounds TileOpt as the spatial stream readiness entity", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    syncMock.mockImplementationOnce(async (...args) => {
      const options = args[5] as
        | {
            isReadyEntity?: (entity: { models: Record<string, unknown> }) => boolean;
          }
        | undefined;

      expect(options?.isReadyEntity?.({ models: { "s1_eternum-Structure": {} } })).toBe(false);
      expect(
        options?.isReadyEntity?.({
          models: { "s1_eternum-TileOpt": { col: 100, row: 100 } },
        }),
      ).toBe(false);
      expect(
        options?.isReadyEntity?.({
          models: { "s1_eternum-TileOpt": { col: 1, row: 2 } },
        }),
      ).toBe(true);

      return syncSubscription(vi.fn());
    });

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
    });

    await manager.switchBounds(descriptor(0));
  });

  it("drops stale middle switch during A->B->A bounds churn", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const firstSwitch = deferred<SyncSubscriptionStub>();
    const secondSwitch = deferred<SyncSubscriptionStub>();
    const thirdSwitch = deferred<SyncSubscriptionStub>();

    const cancelFirst = vi.fn();
    const cancelSecond = vi.fn();
    const cancelThird = vi.fn();

    syncMock
      .mockImplementationOnce(async () => firstSwitch.promise)
      .mockImplementationOnce(async () => secondSwitch.promise)
      .mockImplementationOnce(async () => thirdSwitch.promise);

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
    });

    const pendingA1 = manager.switchBounds(descriptor(0));
    const pendingB = manager.switchBounds(descriptor(24));
    const pendingA2 = manager.switchBounds(descriptor(0));

    firstSwitch.resolve(syncSubscription(cancelFirst));
    secondSwitch.resolve(syncSubscription(cancelSecond));
    thirdSwitch.resolve(syncSubscription(cancelThird));

    const [resultA1, resultB, resultA2] = await Promise.all([pendingA1, pendingB, pendingA2]);

    manager.cancelCurrentSubscription();

    expect(resultA1.outcome).toBe("stale_dropped");
    expect(resultB.outcome).toBe("stale_dropped");
    expect(resultA2.outcome).toBe("applied");
    expect(cancelFirst).toHaveBeenCalledTimes(1);
    expect(cancelSecond).toHaveBeenCalledTimes(1);
    expect(cancelThird).toHaveBeenCalledTimes(1);
  });

  it("passes the subscription setup timeout through to syncEntitiesDebounced", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    syncMock.mockImplementationOnce(async (...args) => {
      const options = args[5] as { subscriptionSetupTimeoutMs?: number } | undefined;
      throw new Error(`timeout:${options?.subscriptionSetupTimeoutMs ?? "missing"}`);
    });

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
      subscriptionSetupTimeoutMs: 25,
    });

    await expect(manager.switchBounds(descriptor(0))).rejects.toThrow("timeout:25");
  });

  it("allows a later bounds switch to recover after a timed out setup", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const cancelRecovered = vi.fn();

    syncMock.mockRejectedValueOnce(new Error("timeout:25")).mockResolvedValueOnce(syncSubscription(cancelRecovered));

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
      subscriptionSetupTimeoutMs: 25,
    });

    await expect(manager.switchBounds(descriptor(0))).rejects.toThrow("timeout:25");

    const recovered = await manager.switchBounds(descriptor(24));

    manager.cancelCurrentSubscription();

    expect(recovered.outcome).toBe("applied");
    expect(cancelRecovered).toHaveBeenCalledTimes(1);
  });

  it("reports subscription setup timeouts with the switch request id", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const onSubscriptionSetupTimeout = vi.fn();

    syncMock.mockImplementationOnce(async (...args) => {
      const options = args[5] as
        | {
            onSubscriptionSetupTimeout?: (info: { label: string; timeoutMs: number }) => void;
          }
        | undefined;
      options?.onSubscriptionSetupTimeout?.({
        label: "event subscription",
        timeoutMs: 25,
      });
      throw new Error("timeout:25");
    });

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
      subscriptionSetupTimeoutMs: 25,
      onSubscriptionSetupTimeout,
    });

    await expect(manager.switchBounds(descriptor(0))).rejects.toThrow("timeout:25");
    expect(onSubscriptionSetupTimeout).toHaveBeenCalledWith({
      label: "event subscription",
      timeoutMs: 25,
      requestId: 1,
    });
  });
});
