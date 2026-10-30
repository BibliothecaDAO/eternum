import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { SeasonList } from "./season-list";
import {
  commonChestAt,
  isPublished,
  prizeShares,
  releasedInDay,
  seasonLordsOf,
  seasonPodium,
  sharePriceOn,
} from "./season-pool";

const SHARES = { common: 2, uncommon: 4, rare: 8, epic: 20, legendary: 40 };
// A season of 100 seconds from 1,000; a million LORDS deposited; Day 3 spans five of them.
const SEASON = { start: 1_000, end: 1_100 };
const DAY_3 = { index: 3, start: 1_010, end: 1_015 };
const CHEST_RULES = { shares: SHARES };

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
    expect(commonChestAt(SHARES, 12n)).toEqual({ lords: 24 });
    expect(commonChestAt({ ...SHARES, common: 1 }, 12n)).toEqual({ lords: 12 });
  });
});

describe("the Season page's LORDS", () => {
  const budget = { pool: 1_000_000n, day: 3n, price: 12n };

  it("are the pool, today's release, and a common chest at today's price", () => {
    expect(seasonLordsOf({ budget, chestRules: CHEST_RULES }, SEASON, DAY_3)).toEqual({
      pool: { lords: 1_000_000, today: 50_000 },
      chest: { lords: 24 },
    });
  });

  it("quote no chest until the day opens, and no today outside the season", () => {
    const yesterday = { ...budget, day: 2n };
    expect(seasonLordsOf({ budget: yesterday, chestRules: CHEST_RULES }, SEASON, DAY_3)).toEqual({
      pool: { lords: 1_000_000, today: 50_000 },
      chest: undefined,
    });
    expect(seasonLordsOf({ budget, chestRules: CHEST_RULES }, SEASON, null)).toEqual({
      pool: { lords: 1_000_000, today: undefined },
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

describe("the Season page's header", () => {
  const header = (props: Pick<Parameters<typeof SeasonList>[0], "chest" | "pool">) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <SeasonList
          rank={12}
          {...props}
          rows={[]}
          pinned={undefined}
          state="ready"
          onRetry={() => undefined}
          onOpen={() => undefined}
          onClose={() => undefined}
        />,
      ),
    );
    const chip = host.querySelector<HTMLElement>("header [role='img']")!;
    const read = { text: host.textContent ?? "", name: chip.getAttribute("aria-label"), tip: chip.dataset.tip };
    act(() => root.unmount());
    return read;
  };

  it("shows what a common chest pays and the rank, with the pool behind the chest on the chip's tip, and no row of figures", () => {
    const read = header({ chest: { lords: 24 }, pool: { lords: 1_000_000, today: 50_000 } });
    expect(read.name).toBe("LORDS 24, Season #12");
    expect(read.tip).toBe("A Common chest pays 24 LORDS today. Season pool 1,000,000 LORDS, 50,000 released today");
    expect(read.text).not.toMatch(/Pool|Today|Per share|Max|1,000,000/);
  });

  it("tips the pool alone before the day's price is set, and says when none is published", () => {
    const unpriced = header({ pool: { lords: 1_000_000, today: undefined } });
    expect(unpriced.name).toBe("Season #12");
    expect(unpriced.tip).toBe("Season pool 1,000,000 LORDS");
    expect(header({ pool: null }).tip).toBe("Pool not published yet");
  });
});

describe("the season's prize places", () => {
  // frontier_prizes.cairo's prize_amount: rank r of N takes N + 1 - r shares of N(N+1)/2, rounded down below the first,
  // and the first keeps what rounding leaves.
  it.each([
    { pool: 90_000n, count: 3, places: [45_000n, 30_000n, 15_000n] },
    { pool: 300n, count: 3, places: [150n, 100n, 50n] },
    { pool: 100n, count: 3, places: [51n, 33n, 16n] },
    { pool: 10n, count: 4, places: [4n, 3n, 2n, 1n] },
    { pool: 1n, count: 3, places: [1n, 0n, 0n] },
    { pool: 7n, count: 1, places: [7n] },
  ])("splits $pool among $count places as the ledger does", ({ pool, count, places }) => {
    expect(prizeShares(pool, count)).toEqual(places);
    expect(prizeShares(pool, count).reduce((sum, share) => sum + share, 0n)).toBe(pool);
  });

  it("refuses a count the ledger refuses", () => {
    expect(() => prizeShares(300n, 0)).toThrow();
    expect(() => prizeShares(300n, 101)).toThrow();
  });
});

describe("the season's podium", () => {
  const entry = (address: string, sites: number) => ({
    address,
    sites_cleared: { total: sites, camps: sites, rifts: 0, ruins: 0, beasts: 0 },
  });
  const entries = [entry("0xa1", 5), entry("0xb2", 3), entry("0xc3", 1), entry("0xd4", 0)];
  const prize = (count: number | null, awards: { rank: number; address: string; lords: string }[] = []) => ({
    pool: "300",
    top_n: 3,
    count,
    awards,
  });

  it("shows nothing to win while no prize pool is published", () => {
    expect(seasonPodium({ prize: null, entries })).toBeNull();
  });

  it("shows what each of the top 3 would take during the season, by the ledger's curve, and who holds it now", () => {
    expect(seasonPodium({ prize: prize(null), entries })).toEqual([
      { place: 1, lords: 150, holder: { address: "0xa1" } },
      { place: 2, lords: 100, holder: { address: "0xb2" } },
      { place: 3, lords: 50, holder: { address: "0xc3" } },
    ]);
  });

  it("leaves a place open while no player who cleared a site holds it, never a player with none", () => {
    const fewer = [entry("0xa1", 2), entry("0xb2", 0), entry("0xc3", 0)];
    expect(seasonPodium({ prize: prize(null), entries: fewer })).toEqual([
      { place: 1, lords: 150, holder: { address: "0xa1" } },
      { place: 2, lords: 100, holder: "open" },
      { place: 3, lords: 50, holder: "open" },
    ]);
  });

  it("once the winners are fixed, names each place by its award receipt, never by today's board", () => {
    // A list fixed before the site rule: 0xd4 cleared none and the board has moved since, yet the ledger paid them third.
    const paid = [
      { rank: 2, address: "0xc3", lords: "100" },
      { rank: 1, address: "0xb2", lords: "150" },
      { rank: 3, address: "0xd4", lords: "50" },
    ];
    expect(seasonPodium({ prize: prize(3, paid), entries })).toEqual([
      { place: 1, lords: 150, holder: { address: "0xb2" } },
      { place: 2, lords: 100, holder: { address: "0xc3" } },
      { place: 3, lords: 50, holder: { address: "0xd4" } },
    ]);
  });

  it("pays only the places the ledger fixed, and shows a fixed place being awarded until its receipt lands", () => {
    // Two winners fixed: the pool split 2/3 and 1/3, though the board has three players who cleared a site.
    expect(seasonPodium({ prize: prize(2, [{ rank: 1, address: "0xa1", lords: "200" }]), entries })).toEqual([
      { place: 1, lords: 200, holder: { address: "0xa1" } },
      { place: 2, lords: 100, holder: "awarding" },
    ]);
    expect(seasonPodium({ prize: prize(3), entries })).toEqual([
      { place: 1, lords: 150, holder: "awarding" },
      { place: 2, lords: 100, holder: "awarding" },
      { place: 3, lords: 50, holder: "awarding" },
    ]);
    // No one qualified: nothing paid.
    expect(seasonPodium({ prize: prize(0), entries })).toEqual([]);
  });
});
