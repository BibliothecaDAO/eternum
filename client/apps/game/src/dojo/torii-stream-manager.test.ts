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

    await Promise.all([pendingFirst, pendingSecond]);

    manager.cancelCurrentSubscription();

    expect(cancelFirst).toHaveBeenCalledTimes(1);
    expect(cancelSecond).toHaveBeenCalledTimes(1);
  });
});

