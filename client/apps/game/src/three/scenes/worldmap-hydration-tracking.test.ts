import { describe, expect, it } from "vitest";
import { shouldTrackHydrationUpdateForFetch } from "./worldmap-hydration-tracking";

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
});
