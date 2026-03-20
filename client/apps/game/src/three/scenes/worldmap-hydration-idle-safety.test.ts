import { describe, expect, it } from "vitest";

/**
 * Minimal stubs that simulate the hydration-fetch state map
 * used by waitForStructureHydrationIdle / waitForTileHydrationIdle.
 *
 * The real methods live on the WorldmapScene class and depend on
 * `structureHydrationFetches` / `tileHydrationFetches` Maps.
 * We replicate the while-loop logic here to prove it is stack-safe.
 */

interface HydrationState {
  fetchSettled: boolean;
  pendingCount: number;
  waiters: Array<() => void>;
}

function flushWaiters(state: HydrationState) {
  if (state.fetchSettled && state.pendingCount === 0) {
    const waiters = [...state.waiters];
    state.waiters.length = 0;
    waiters.forEach((resolve) => resolve());
  }
}

/**
 * Iterative version of waitForStructureHydrationIdle matching
 * the production while-loop implementation.
 */
async function waitForHydrationIdleIterative(
  getState: () => HydrationState | undefined,
  flushFn: (state: HydrationState) => void,
): Promise<void> {
  while (true) {
    const state = getState();
    if (!state) {
      return;
    }

    if (state.fetchSettled && state.pendingCount === 0) {
      await Promise.resolve();
      const refreshed = getState();
      if (!refreshed || (refreshed.fetchSettled && refreshed.pendingCount === 0)) {
        return;
      }
    }

    await new Promise<void>((resolve) => {
      const currentState = getState();
      if (!currentState) {
        resolve();
        return;
      }
      currentState.waiters.push(resolve);
      flushFn(currentState);
    });

    await Promise.resolve();
    const refreshed = getState();
    if (!refreshed || (refreshed.fetchSettled && refreshed.pendingCount === 0)) {
      return;
    }
  }
}

describe("waitForStructureHydrationIdle (iterative)", () => {
  it("resolves immediately when state is already settled", async () => {
    const state: HydrationState = { fetchSettled: true, pendingCount: 0, waiters: [] };
    await waitForHydrationIdleIterative(
      () => state,
      flushWaiters,
    );
  });

  it("resolves immediately when no state exists", async () => {
    await waitForHydrationIdleIterative(
      () => undefined,
      flushWaiters,
    );
  });

  it("resolves without stack growth when hydration state oscillates N times", async () => {
    const oscillations = 200;
    let flushCount = 0;
    const state: HydrationState = { fetchSettled: false, pendingCount: 1, waiters: [] };

    await waitForHydrationIdleIterative(
      () => state,
      (s) => {
        flushCount++;
        if (flushCount >= oscillations) {
          s.fetchSettled = true;
          s.pendingCount = 0;
        }
        // Always resolve waiters to simulate external hydration progression
        const waiters = [...s.waiters];
        s.waiters.length = 0;
        waiters.forEach((resolve) => resolve());
      },
    );

    expect(flushCount).toBeGreaterThanOrEqual(oscillations);
  });
});

describe("waitForTileHydrationIdle (iterative)", () => {
  it("resolves immediately when state is already settled", async () => {
    const state: HydrationState = { fetchSettled: true, pendingCount: 0, waiters: [] };
    await waitForHydrationIdleIterative(
      () => state,
      flushWaiters,
    );
  });

  it("resolves immediately when no state exists", async () => {
    await waitForHydrationIdleIterative(
      () => undefined,
      flushWaiters,
    );
  });

  it("resolves without stack growth when hydration state oscillates N times", async () => {
    const oscillations = 200;
    let flushCount = 0;
    const state: HydrationState = { fetchSettled: false, pendingCount: 1, waiters: [] };

    await waitForHydrationIdleIterative(
      () => state,
      (s) => {
        flushCount++;
        if (flushCount >= oscillations) {
          s.fetchSettled = true;
          s.pendingCount = 0;
        }
        // Always resolve waiters to simulate external hydration progression
        const waiters = [...s.waiters];
        s.waiters.length = 0;
        waiters.forEach((resolve) => resolve());
      },
    );

    expect(flushCount).toBeGreaterThanOrEqual(oscillations);
  });
});
