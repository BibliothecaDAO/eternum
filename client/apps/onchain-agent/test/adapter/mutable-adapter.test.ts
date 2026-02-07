import { describe, expect, it, vi } from "vitest";
import type { GameAdapter } from "@bibliothecadao/game-agent";
import { MutableGameAdapter } from "../../src/adapter/mutable-adapter";

function createAdapter(tick: number): GameAdapter {
  return {
    getWorldState: vi.fn(async () => ({ tick, timestamp: Date.now(), entities: [] })),
    executeAction: vi.fn(async () => ({ success: true, txHash: `0x${tick}` })),
    simulateAction: vi.fn(async () => ({ success: true, outcome: { tick } })),
  };
}

describe("MutableGameAdapter", () => {
  it("delegates calls to the current adapter and can hot-swap adapter instances", async () => {
    const first = createAdapter(1);
    const second = createAdapter(2);
    const mutable = new MutableGameAdapter(first);

    const firstState = await mutable.getWorldState();
    expect(firstState.tick).toBe(1);

    mutable.setAdapter(second);
    const secondState = await mutable.getWorldState();
    expect(secondState.tick).toBe(2);

    const executeResult = await mutable.executeAction({ type: "noop", params: {} });
    expect(executeResult.txHash).toBe("0x2");

    const simulation = await mutable.simulateAction({ type: "noop", params: {} });
    expect(simulation.success).toBe(true);
    expect(mutable.getAdapter()).toBe(second);
  });

  it("supports subscribe passthrough and safe no-op fallback", () => {
    const unsubscribe = vi.fn();
    const withSubscribe: GameAdapter = {
      getWorldState: vi.fn(async () => ({ tick: 1, timestamp: Date.now(), entities: [] })),
      executeAction: vi.fn(async () => ({ success: true })),
      simulateAction: vi.fn(async () => ({ success: true })),
      subscribe: vi.fn(() => unsubscribe),
    };
    const withoutSubscribe: GameAdapter = {
      getWorldState: vi.fn(async () => ({ tick: 2, timestamp: Date.now(), entities: [] })),
      executeAction: vi.fn(async () => ({ success: true })),
      simulateAction: vi.fn(async () => ({ success: true })),
    };

    const mutable = new MutableGameAdapter(withSubscribe);
    const callback = vi.fn();
    const teardown = mutable.subscribe!(callback);
    expect(typeof teardown).toBe("function");
    teardown();
    expect(unsubscribe).toHaveBeenCalledOnce();

    mutable.setAdapter(withoutSubscribe);
    const noopTeardown = mutable.subscribe!(callback);
    expect(typeof noopTeardown).toBe("function");
    expect(() => noopTeardown()).not.toThrow();
  });
});
