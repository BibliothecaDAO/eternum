import { describe, expect, it } from "vitest";
import { raceRewards, type RaceFacts } from "./race-amounts";

const LORDS = 10n ** 18n;
const GLORY = 10n ** 9n;
const facts = (overrides: Partial<RaceFacts> = {}): RaceFacts => ({
  winner: null,
  heights: [
    { aspect: 1, height: 0 },
    { aspect: 2, height: 0 },
    { aspect: 3, height: 0 },
    { aspect: 4, height: 0 },
  ],
  members: [],
  ...overrides,
});
const heights = (...values: number[]) => values.map((height, index) => ({ aspect: index + 1, height }));

describe("raceRewards", () => {
  it("pays 10 LORDS per point of height and 100,000 LORDS more to the Aspect that finished, shared by Glory", () => {
    const result = raceRewards(
      facts({
        winner: 2,
        heights: heights(300, 10_000, 0, 50),
        members: [
          { home: 7n, aspect: 1, glory: 300n * GLORY },
          { home: 5n, aspect: 1, glory: 100n * GLORY },
          { home: 9n, aspect: 2, glory: 250n * GLORY },
          { home: 8n, aspect: 4, glory: 1000n * GLORY },
        ],
      }),
    );
    expect(result.rewards).toEqual([
      { home: 5n, aspect: 1, amount: 750n * LORDS },
      { home: 7n, aspect: 1, amount: 2250n * LORDS },
      { home: 8n, aspect: 4, amount: 500n * LORDS },
      { home: 9n, aspect: 2, amount: 200_000n * LORDS },
    ]);
    expect(result.total).toBe(203_500n * LORDS);
  });

  it("owes at most 500,000 LORDS when every Aspect is as high as it can be", () => {
    const members = [1, 2, 3, 4].map((aspect) => ({ home: BigInt(aspect), aspect, glory: 100n * GLORY }));
    expect(raceRewards(facts({ winner: 1, heights: heights(10_000, 9_999, 9_999, 9_999), members })).total).toBe(
      499_970n * LORDS,
    );
  });

  it("gives nothing below 100 Glory and counts only eligible Glory in the shares", () => {
    const result = raceRewards(
      facts({
        heights: heights(100, 0, 0, 0),
        members: [
          { home: 1n, aspect: 1, glory: 100n * GLORY },
          { home: 2n, aspect: 1, glory: 100n * GLORY - 1n },
          { home: 3n, aspect: 1, glory: 0n },
        ],
      }),
    );
    expect(result.rewards).toEqual([{ home: 1n, aspect: 1, amount: 1000n * LORDS }]);
  });

  it("floors each share to the wei and leaves the remainder unassigned", () => {
    const members = [1n, 2n, 3n].map((home) => ({ home, aspect: 3, glory: 100n * GLORY }));
    const result = raceRewards(facts({ heights: heights(0, 0, 1, 0), members }));
    expect(result.rewards.map((reward) => reward.amount)).toEqual(Array(3).fill(3_333_333_333_333_333_333n));
    expect(result.total).toBe(10n * LORDS - 1n);
  });

  it("leaves an Aspect's amount and the finish bonus unassigned when nobody can share them", () => {
    const result = raceRewards(
      facts({
        winner: 4,
        heights: heights(500, 0, 0, 10_000),
        members: [{ home: 1n, aspect: 2, glory: 900n * GLORY }],
      }),
    );
    expect(result).toEqual({ total: 0n, rewards: [] });
  });

  it("pays no finish bonus when the season ends with no Aspect finished", () => {
    const members = [{ home: 1n, aspect: 1, glory: 100n * GLORY }];
    expect(raceRewards(facts({ heights: heights(9_999, 0, 0, 0), members })).total).toBe(99_990n * LORDS);
  });

  it.each<[string, Partial<RaceFacts>]>([
    ["race_heights_incomplete", { heights: heights(1, 2, 3) }],
    ["race_heights_incomplete", { heights: [...heights(1, 2, 3), { aspect: 3, height: 4 }] }],
    ["race_height_invalid", { heights: heights(-1, 0, 0, 0) }],
    ["race_height_invalid", { heights: heights(1.5, 0, 0, 0) }],
    ["race_winner_invalid", { winner: 5 }],
    [
      "race_member_duplicated",
      {
        members: [
          { home: 1n, aspect: 1, glory: 0n },
          { home: 1n, aspect: 2, glory: 0n },
        ],
      },
    ],
    ["race_member_invalid", { members: [{ home: 1n, aspect: 5, glory: 0n }] }],
    ["race_member_invalid", { members: [{ home: 0n, aspect: 1, glory: 0n }] }],
  ])("refuses facts that cannot be a finished race: %s", (error, overrides) => {
    expect(() => raceRewards(facts(overrides))).toThrow(error);
  });
});
