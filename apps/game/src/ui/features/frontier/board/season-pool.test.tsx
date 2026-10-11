import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { SeasonList } from "./season-list";
import { publishedPoolOf, releasedInDay } from "./season-pool";

describe("a Frontier season's pool", () => {
  it("is the amount published to the game's budget row, and nothing before it is", () => {
    expect(publishedPoolOf({ pool: 1_000_000n })).toBe(1_000_000n);
    // No row yet, or a row a failed draw touched before the deposit was published: no pool.
    expect(publishedPoolOf(undefined)).toBeNull();
    expect(publishedPoolOf({ pool: 0n })).toBeNull();
  });

  it("releases each day its share of the season's length, the last day stopping at the season's end", () => {
    // A season of 100 seconds from 1,000; a million LORDS deposited.
    const season = { start: 1_000, end: 1_100 };
    expect(releasedInDay(1_000_000n, season, { start: 1_000, end: 1_005 })).toBe(50_000n);
    // A longer day releases more: days differ in length.
    expect(releasedInDay(1_000_000n, season, { start: 1_005, end: 1_017 })).toBe(120_000n);
    // The last day would run past the end: it releases only what is left of the season.
    expect(releasedInDay(1_000_000n, season, { start: 1_090, end: 1_110 })).toBe(100_000n);
    // Every day's release adds up to the pool, rounding included.
    const days = [1_000, 1_033, 1_066, 1_100].map((start, index, starts) => ({
      start,
      end: starts[index + 1] ?? 1_100,
    }));
    expect(days.slice(0, 3).reduce((sum, day) => sum + releasedInDay(100n, season, day), 0n)).toBe(100n);
  });
});

describe("the Season page", () => {
  const page = (pool: Parameters<typeof SeasonList>[0]["pool"]) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <SeasonList
          rank={12}
          pool={pool}
          rows={[]}
          pinned={undefined}
          state="ready"
          onRetry={() => undefined}
          onOpen={() => undefined}
          onBack={() => undefined}
        />,
      ),
    );
    const text = host.textContent ?? "";
    act(() => root.unmount());
    return text;
  };

  it("shows the published pool and what today releases of it", () => {
    const text = page({ lords: 1_000_000, today: 50_000 });
    expect(text).toContain("Pool1,000,000");
    expect(text).toContain("Today+50,000");
    // Before the season starts, or once it has ended, there is no today to release.
    expect(page({ lords: 1_000_000, today: undefined })).not.toContain("Today");
  });

  it("says the pool is not published yet, in the figures' place, and nothing while the game is unknown", () => {
    const unpublished = page(null);
    expect(unpublished).toContain("Pool not published yet");
    expect(unpublished).not.toContain("Today");
    expect(page(undefined)).not.toContain("Pool");
  });
});
