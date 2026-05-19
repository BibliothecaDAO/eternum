import { describe, expect, it } from "vitest";
import {
  clearHydrationFetchState,
  shouldTrackHydrationUpdateForFetch,
  trackHydrationUpdateWorkForFetches,
} from "./worldmap-hydration-tracking";
import { createDeferred } from "./worldmap-test-harness";

describe("shouldTrackHydrationUpdateForFetch", () => {
  it("tracks in-bounds updates while the fetch is still settling", () => {
    expect(
      shouldTrackHydrationUpdateForFetch(
        {
          minCol: 10,
          maxCol: 20,
          minRow: 30,
          maxRow: 40,
          fetchSettled: false,
        },
        { col: 15, row: 35 },
      ),
    ).toBe(true);
  });

  it("ignores live updates after the fetch settles", () => {
    expect(
      shouldTrackHydrationUpdateForFetch(
        {
          minCol: 10,
          maxCol: 20,
          minRow: 30,
          maxRow: 40,
          fetchSettled: true,
        },
        { col: 15, row: 35 },
      ),
    ).toBe(false);
  });

  it("ignores out-of-bounds updates before the fetch settles", () => {
    expect(
      shouldTrackHydrationUpdateForFetch(
        {
          minCol: 10,
          maxCol: 20,
          minRow: 30,
          maxRow: 40,
          fetchSettled: false,
        },
        { col: 25, row: 35 },
      ),
    ).toBe(false);
  });

  it("holds matching hydration fetches open until async update work finishes", async () => {
    const work = createDeferred<void>();
    const flushes: Array<{ fetchKey: string; pendingCount: number }> = [];
    const fetches = new Map([
      [
        "matching-area",
        {
          minCol: 10,
          maxCol: 20,
          minRow: 30,
          maxRow: 40,
          pendingCount: 0,
          fetchSettled: false,
          waiters: [],
        },
      ],
      [
        "settled-area",
        {
          minCol: 10,
          maxCol: 20,
          minRow: 30,
          maxRow: 40,
          pendingCount: 0,
          fetchSettled: true,
          waiters: [],
        },
      ],
    ]);

    const trackedWork = trackHydrationUpdateWorkForFetches({
      fetches,
      position: { col: 15, row: 35 },
      work: work.promise,
      flushWaiters: (fetchKey, state) => {
        flushes.push({ fetchKey, pendingCount: state.pendingCount });
      },
    });

    expect(fetches.get("matching-area")?.pendingCount).toBe(1);
    expect(fetches.get("settled-area")?.pendingCount).toBe(0);

    work.resolve();
    await trackedWork;

    expect(fetches.get("matching-area")?.pendingCount).toBe(0);
    expect(flushes).toEqual([{ fetchKey: "matching-area", pendingCount: 0 }]);
  });

  it("resolves waiters before deleting a cleared hydration fetch", async () => {
    let waiterResolved = false;
    const fetches = new Map([
      [
        "matching-area",
        {
          minCol: 10,
          maxCol: 20,
          minRow: 30,
          maxRow: 40,
          pendingCount: 1,
          fetchSettled: false,
          waiters: [
            () => {
              waiterResolved = true;
            },
          ],
        },
      ],
    ]);

    clearHydrationFetchState(fetches, "matching-area");

    expect(fetches.has("matching-area")).toBe(false);
    expect(waiterResolved).toBe(true);
  });
});
