import { describe, expect, it } from "vitest";
import { createControlledAsyncCall, createDeferred, flushMicrotasks } from "./worldmap-test-harness";

describe("createDeferred", () => {
  it("stays pending until resolved and then yields the resolved value", async () => {
    const deferred = createDeferred<number>();
    let settled = false;
    void deferred.promise.then(() => {
      settled = true;
    });

    await flushMicrotasks();
    expect(settled).toBe(false);

    deferred.resolve(42);
    await flushMicrotasks(2);
    await expect(deferred.promise).resolves.toBe(42);
    expect(settled).toBe(true);
  });
});

describe("createControlledAsyncCall", () => {
  it("tracks calls and resolves them in FIFO order", async () => {
    const controlled = createControlledAsyncCall<[string], boolean>();

    const firstPromise = controlled.fn("chunk-a");
    const secondPromise = controlled.fn("chunk-b");

    expect(controlled.calls).toEqual([["chunk-a"], ["chunk-b"]]);
    expect(controlled.pendingCount()).toBe(2);

    controlled.resolveNext(true);
    await expect(firstPromise).resolves.toBe(true);
    expect(controlled.pendingCount()).toBe(1);

    controlled.resolveNext(false);
    await expect(secondPromise).resolves.toBe(false);
    expect(controlled.pendingCount()).toBe(0);
  });

  it("throws when trying to resolve without pending calls", () => {
    const controlled = createControlledAsyncCall<[], void>();

    expect(() => controlled.resolveNext()).toThrow("No pending controlled async calls to resolve");
  });
});
