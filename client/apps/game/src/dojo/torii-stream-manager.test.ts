import { describe, expect, it, vi } from "vitest";

vi.mock("./sync", () => ({
  syncEntitiesDebounced: vi.fn(),
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

const descriptor = (minCol: number): BoundsDescriptor => ({
  minCol,
  maxCol: minCol + 10,
  minRow: 0,
  maxRow: 10,
  models: [{ model: "s1_eternum-TileOpt", colField: "col", rowField: "row" }],
});

describe("ToriiStreamManager", () => {
  it("reports skipped outcome when switching to an unchanged signature", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const cancel = vi.fn();
    syncMock.mockImplementation(async () => ({ cancel }));

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

  it("keeps the newest bounds subscription active when switches race", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const firstSwitch = deferred<{ cancel: () => void }>();
    const secondSwitch = deferred<{ cancel: () => void }>();

    const cancelFirst = vi.fn();
    const cancelSecond = vi.fn();

    syncMock.mockImplementationOnce(async () => firstSwitch.promise).mockImplementationOnce(async () => secondSwitch.promise);

    const manager = new ToriiStreamManager({
      client: {} as any,
      setup: {} as any,
      logging: false,
    });

    const pendingFirst = manager.switchBounds(descriptor(0));
    const pendingSecond = manager.switchBounds(descriptor(24));

    // Resolve second first to simulate out-of-order completion.
    secondSwitch.resolve({ cancel: cancelSecond });
    await Promise.resolve();

    firstSwitch.resolve({ cancel: cancelFirst });

    const [firstResult, secondResult] = await Promise.all([pendingFirst, pendingSecond]);

    manager.cancelCurrentSubscription();

    expect(firstResult.outcome).toBe("stale_dropped");
    expect(secondResult.outcome).toBe("applied");
    expect(cancelFirst).toHaveBeenCalledTimes(1);
    expect(cancelSecond).toHaveBeenCalledTimes(1);
  });

  it("drops stale middle switch during A->B->A bounds churn", async () => {
    const syncMock = vi.mocked(syncEntitiesDebounced);
    const firstSwitch = deferred<{ cancel: () => void }>();
    const secondSwitch = deferred<{ cancel: () => void }>();
    const thirdSwitch = deferred<{ cancel: () => void }>();

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

    firstSwitch.resolve({ cancel: cancelFirst });
    secondSwitch.resolve({ cancel: cancelSecond });
    thirdSwitch.resolve({ cancel: cancelThird });

    const [resultA1, resultB, resultA2] = await Promise.all([pendingA1, pendingB, pendingA2]);

    manager.cancelCurrentSubscription();

    expect(resultA1.outcome).toBe("stale_dropped");
    expect(resultB.outcome).toBe("stale_dropped");
    expect(resultA2.outcome).toBe("applied");
    expect(cancelFirst).toHaveBeenCalledTimes(1);
    expect(cancelSecond).toHaveBeenCalledTimes(1);
    expect(cancelThird).toHaveBeenCalledTimes(1);
  });
});
