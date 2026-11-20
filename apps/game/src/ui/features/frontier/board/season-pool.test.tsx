import { describe, expect, it } from "vitest";

import { seasonPodium } from "./season-pool";

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
