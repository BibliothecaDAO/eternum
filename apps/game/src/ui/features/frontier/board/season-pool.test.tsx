import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { SeasonList } from "./season-list";
import { commonChestAt, isPublished, releasedInDay, seasonLordsOf, sharePriceOn } from "./season-pool";

const SHARES = { common: 2, uncommon: 4, rare: 8, epic: 20, legendary: 40 };
// A season of 100 seconds from 1,000; a million LORDS deposited; Day 3 spans five of them.
const SEASON = { start: 1_000, end: 1_100 };
const DAY_3 = { index: 3, start: 1_010, end: 1_015 };
const CHEST_RULES = { price_ceiling: 15n, shares: SHARES };

describe("a Frontier season's pool", () => {
  it("is the amount published to the game's budget row, and nothing before it is", () => {
    expect(isPublished({ pool: 1_000_000n })).toBe(true);
    // No row yet, or a row a failed draw touched before the deposit was published: no pool.
    expect(isPublished(undefined)).toBe(false);
    expect(isPublished({ pool: 0n })).toBe(false);
  });

  it("releases each day its share of the season's length, the last day stopping at the season's end", () => {
    expect(releasedInDay(1_000_000n, SEASON, { start: 1_000, end: 1_005 })).toBe(50_000n);
    // A longer day releases more: days differ in length.
    expect(releasedInDay(1_000_000n, SEASON, { start: 1_005, end: 1_017 })).toBe(120_000n);
    // The last day would run past the end: it releases only what is left of the season.
    expect(releasedInDay(1_000_000n, SEASON, { start: 1_090, end: 1_110 })).toBe(100_000n);
    // Every day's release adds up to the pool, rounding included.
    const days = [1_000, 1_033, 1_066, 1_100].map((start, index, starts) => ({
      start,
      end: starts[index + 1] ?? 1_100,
    }));
    expect(days.slice(0, 3).reduce((sum, day) => sum + releasedInDay(100n, SEASON, day), 0n)).toBe(100n);
  });
});

describe("a share's price", () => {
  it("is the budget row's on the day the row stands on, and unknown on a day that has not opened", () => {
    expect(sharePriceOn({ day: 3n, price: 12n }, 3)).toBe(12n);
    // The row still holds yesterday's price until today's first ruin roll turns it.
    expect(sharePriceOn({ day: 2n, price: 12n }, 3)).toBeNull();
  });

  it("pays a common chest its tier's shares", () => {
    expect(commonChestAt(SHARES, 12n)).toEqual({ tier: 1, lords: 24 });
    expect(commonChestAt({ ...SHARES, common: 1 }, 12n)).toEqual({ tier: 1, lords: 12 });
  });
});

describe("the Season page's LORDS", () => {
  const budget = { pool: 1_000_000n, day: 3n, price: 12n };

  it("are the pool, today's release, today's price under the ceiling, and a common chest at today's price", () => {
    expect(seasonLordsOf({ budget, chestRules: CHEST_RULES }, SEASON, DAY_3)).toEqual({
      pool: { lords: 1_000_000, today: 50_000, price: 12, ceiling: 15 },
      chest: { tier: 1, lords: 24 },
    });
  });

  it("quote neither a price nor a chest until the day opens: the ceiling is no day's price", () => {
    const yesterday = { ...budget, day: 2n };
    expect(seasonLordsOf({ budget: yesterday, chestRules: CHEST_RULES }, SEASON, DAY_3)).toEqual({
      pool: { lords: 1_000_000, today: 50_000, price: undefined, ceiling: 15 },
      chest: undefined,
    });
    // Before the season starts and after it ends there is no today at all.
    expect(seasonLordsOf({ budget, chestRules: CHEST_RULES }, SEASON, null)).toEqual({
      pool: { lords: 1_000_000, today: undefined, price: undefined, ceiling: 15 },
      chest: undefined,
    });
  });

  it("are no pool, and no chest, while nothing is published: an unfunded row's price pays nothing", () => {
    const unfunded = { pool: 0n, day: 3n, price: 15n };
    expect(seasonLordsOf({ budget: unfunded, chestRules: CHEST_RULES }, SEASON, DAY_3)).toEqual({
      pool: null,
      chest: undefined,
    });
    expect(seasonLordsOf({ budget: undefined, chestRules: CHEST_RULES }, SEASON, DAY_3).pool).toBeNull();
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

  it("shows the published pool, what today releases of it, and a share's price today beside its ceiling", () => {
    const text = page({ lords: 1_000_000, today: 50_000, price: 12, ceiling: 15 });
    expect(text).toContain("Pool1,000,000");
    expect(text).toContain("Today+50,000");
    expect(text).toContain("Per share12");
    expect(text).toContain("Max15");
  });

  it("shows the ceiling alone until the day's price is set, and no today outside the season", () => {
    const unopened = page({ lords: 1_000_000, today: 50_000, price: undefined, ceiling: 15 });
    expect(unopened).toContain("Max15");
    expect(unopened).not.toContain("Per share");
    expect(page({ lords: 1_000_000, today: undefined, price: undefined, ceiling: 15 })).not.toContain("Today");
  });

  it("says the pool is not published yet, in the figures' place, and nothing while the game is unknown", () => {
    const unpublished = page(null);
    expect(unpublished).toContain("Pool not published yet");
    expect(unpublished).not.toMatch(/Today|Per share|Max/);
    expect(page(undefined)).not.toContain("Pool");
  });
});
