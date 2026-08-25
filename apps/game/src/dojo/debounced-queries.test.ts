// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  getBuildingsFromTorii: vi.fn(),
  getEntitiesFromTorii: vi.fn(),
  getOwnedArmiesFromTorii: vi.fn(),
}));

vi.mock("./queries", () => queryMocks);

import { clearSubscriptionQueue, debouncedGetBuildingsFromTorii } from "./debounced-queries";

const createDeferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const flushMicrotasks = async (count = 4) => {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
};

describe("debounced Torii query queue", () => {
  afterEach(() => {
    clearSubscriptionQueue();
    vi.clearAllMocks();
  });

  it("resolves a debounced building query only after the queued Torii request completes", async () => {
    const request = createDeferred();
    queryMocks.getBuildingsFromTorii.mockReturnValueOnce(request.promise);

    let settled = false;
    const promise = debouncedGetBuildingsFromTorii({} as any, [{ col: 12, row: 34 }]).then(() => {
      settled = true;
    });

    await flushMicrotasks();
    expect(settled).toBe(false);

    request.resolve();
    await promise;

    expect(settled).toBe(true);
    expect(queryMocks.getBuildingsFromTorii).toHaveBeenCalledTimes(1);
  });

  it("settles queued building queries when the queue is cleared", async () => {
    const blockingRequest = createDeferred();
    queryMocks.getBuildingsFromTorii.mockReturnValueOnce(blockingRequest.promise).mockResolvedValueOnce(undefined);

    const inFlightPromise = debouncedGetBuildingsFromTorii({} as any, [{ col: 1, row: 1 }]);
    let queuedSettled = false;
    const queuedPromise = debouncedGetBuildingsFromTorii({} as any, [{ col: 99, row: 99 }]).then(() => {
      queuedSettled = true;
    });

    await flushMicrotasks();
    expect(queryMocks.getBuildingsFromTorii).toHaveBeenCalledTimes(1);

    clearSubscriptionQueue();
    await queuedPromise;

    expect(queuedSettled).toBe(true);
    expect(queryMocks.getBuildingsFromTorii).toHaveBeenCalledTimes(1);

    blockingRequest.resolve();
    await inFlightPromise;
  });
});
