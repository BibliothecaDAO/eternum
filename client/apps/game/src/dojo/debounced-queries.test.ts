import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBuildingsFromToriiMock,
  getEntitiesFromToriiMock,
  getOwnedArmiesFromToriiMock,
  getTilesForPositionsFromToriiMock,
} = vi.hoisted(() => ({
  getBuildingsFromToriiMock: vi.fn(),
  getEntitiesFromToriiMock: vi.fn(),
  getOwnedArmiesFromToriiMock: vi.fn(),
  getTilesForPositionsFromToriiMock: vi.fn(),
}));

vi.mock("./queries", () => ({
  getBuildingsFromTorii: getBuildingsFromToriiMock,
  getEntitiesFromTorii: getEntitiesFromToriiMock,
  getOwnedArmiesFromTorii: getOwnedArmiesFromToriiMock,
  getTilesForPositionsFromTorii: getTilesForPositionsFromToriiMock,
}));

import { clearSubscriptionQueue, debouncedGetEntitiesFromTorii } from "./debounced-queries";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function hasSettled(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  void promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );

  await Promise.resolve();
  await Promise.resolve();
  return settled;
}

async function getPromiseState(promise: Promise<unknown>): Promise<"fulfilled" | "rejected" | "pending"> {
  return Promise.race([
    promise.then(
      () => "fulfilled" as const,
      () => "rejected" as const,
    ),
    new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 20)),
  ]);
}

describe("debounced Torii queries", () => {
  beforeEach(() => {
    clearSubscriptionQueue();
    getBuildingsFromToriiMock.mockReset();
    getEntitiesFromToriiMock.mockReset();
    getOwnedArmiesFromToriiMock.mockReset();
    getTilesForPositionsFromToriiMock.mockReset();
  });

  it("resolves entity sync only after the queued Torii request completes", async () => {
    const request = createDeferred<void>();
    const onComplete = vi.fn();
    getEntitiesFromToriiMock.mockReturnValueOnce(request.promise);

    const syncPromise = debouncedGetEntitiesFromTorii(
      {} as never,
      [] as never,
      [123],
      ["s1_eternum-Structure"],
      onComplete,
    );

    expect(await hasSettled(syncPromise)).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();

    request.resolve();

    await expect(syncPromise).resolves.toBeUndefined();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("settles queued entity syncs without running Torii when the subscription queue is cleared", async () => {
    const runningRequest = createDeferred<void>();
    getEntitiesFromToriiMock.mockReturnValueOnce(runningRequest.promise).mockResolvedValueOnce(undefined);
    const onComplete = vi.fn();

    const activeSync = debouncedGetEntitiesFromTorii({} as never, [] as never, [1], ["s1_eternum-Structure"]);
    const queuedSync = debouncedGetEntitiesFromTorii(
      {} as never,
      [] as never,
      [2],
      ["s1_eternum-Structure"],
      onComplete,
    );

    clearSubscriptionQueue();

    expect(await getPromiseState(queuedSync)).toBe("fulfilled");
    expect(getEntitiesFromToriiMock).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);

    runningRequest.resolve();
    await activeSync;
  });
});
