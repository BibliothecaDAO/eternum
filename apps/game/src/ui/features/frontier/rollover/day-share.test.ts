import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { ResourcesIds } from "@bibliothecadao/types";

import { DAY_MARKS, dayBest, dayPostText, dayTrail, rankMove, TRAIL_LENGTH, type DayMark } from "./day-share";

const at = (minute: number) => minute * 60_000;
const clear = (category: StructureType, minute: number) => ({
  story: "SitePayout",
  storyPayload: { category, site_id: 7, reward: null },
  timestampMs: at(minute),
});
const fight = (minute: number, after: { army: string; guard: string }) => ({
  story: "BattleEvent",
  storyPayload: {
    attacker: { before: "500000000000", after: after.army },
    defender: { before: "1", after: after.guard },
  },
  timestampMs: at(minute),
});
const TOTALS = { reveals: 31, cleared: 4, chests: 1, essence: 1200, labor: 340, lords: 0 };

describe("a Frontier day's trail", () => {
  it("marks each clear by its site, each chest, and each fight that cleared nothing, in the order they happened", () => {
    const stories = [
      clear(StructureType.Rift, 30),
      { story: "ExplorationReward", storyPayload: {}, timestampMs: at(1) },
      clear(StructureType.Ruin, 10),
      fight(9, { army: "432000000000", guard: "0" }),
      fight(20, { army: "0", guard: "90000000000" }),
      fight(25, { army: "300000000000", guard: "90000000000" }),
      { story: "RewardChestOpened", storyPayload: { amount: "5" }, timestampMs: at(40) },
      clear(StructureType.Beasts, 50),
      clear(StructureType.Camp, 60),
    ];
    expect(dayTrail(stories)).toEqual(["Ruin", "army-lost", "guard-holds", "Rift", "chest", "Beasts", "Camp"]);
  });

  it("is empty for a day of scouting alone", () => {
    expect(dayTrail([{ story: "ExplorationReward", storyPayload: {}, timestampMs: 0 }])).toEqual([]);
  });

  it("gives every mark its own emoji, so a post's line reads one way", () => {
    const emoji = Object.values(DAY_MARKS);
    expect(new Set(emoji).size).toBe(emoji.length);
  });
});

describe("a Frontier day's post", () => {
  it("leads with the day and its closing rank, then the totals, then the trail", () => {
    expect(
      dayPostText({
        game: "Frontier",
        day: 12,
        totals: TOTALS,
        rank: { from: 9, to: 7 },
        trail: ["Ruin", "Rift", "Rift", "army-lost", "Beasts", "Camp"],
      }),
    ).toBe("Frontier · Day 12 · #7 ▲2\n🧭 31 · 🚩 4 · 🎁 1\n🏛️🌀🌀💀🐺👹");
  });

  it("says no rank on the season's first day and no trail for a day of scouting", () => {
    expect(dayPostText({ game: "Frontier", day: 1, totals: TOTALS, rank: undefined, trail: [] })).toBe(
      "Frontier · Day 1\n🧭 31 · 🚩 4 · 🎁 1",
    );
  });

  it("counts the marks past its line", () => {
    const trail = Array.from({ length: TRAIL_LENGTH + 2 }, (): DayMark => "Camp");
    expect(dayPostText({ game: "Frontier", day: 3, totals: TOTALS, rank: { from: 4, to: 4 }, trail })).toBe(
      `Frontier · Day 3 · #4\n🧭 31 · 🚩 4 · 🎁 1\n${"👹".repeat(TRAIL_LENGTH)} +2`,
    );
  });

  it("writes a rank's move up, down or none", () => {
    expect(rankMove({ from: 9, to: 7 })).toBe("▲2");
    expect(rankMove({ from: 7, to: 9 })).toBe("▼2");
    expect(rankMove({ from: 7, to: 7 })).toBe("");
  });
});

describe("a Frontier day's best moment", () => {
  /** A clear of site `site` (of `category`), won by a fight against a guard of `guard` whole troops, paying `paid`. */
  const won = (
    site: number,
    category: StructureType,
    guard: number,
    paid: { resource: number; amount: number } | null,
  ) => [
    {
      story: "BattleEvent",
      storyPayload: {
        defender_id: site,
        attacker: { before: "900000000000", after: "800000000000" },
        defender: { before: `${guard}000000000`, after: "0" },
      },
      timestampMs: at(site),
    },
    {
      story: "SitePayout",
      storyPayload: {
        site_id: site,
        category,
        reward: paid && { resource_type: paid.resource, amount: `${paid.amount}000000000` },
      },
      timestampMs: at(site),
    },
  ];

  it("is the clear of the strongest guard, with the site, the guard and what it paid", () => {
    const stories = [
      ...won(1, StructureType.Camp, 300, { resource: ResourcesIds.Labor, amount: 650 }),
      ...won(2, StructureType.Rift, 666, { resource: ResourcesIds.Essence, amount: 4_800 }),
      // A guard that held is no clear.
      fight(3, { army: "0", guard: "900000000000" }),
    ];
    expect(dayBest(stories, 38)).toEqual({
      kind: "clear",
      site: "Rift",
      guard: 666,
      paid: { resource: "essence", amount: 4_800 },
    });
  });

  it("puts a ruin chest's LORDS before any clear", () => {
    const stories = [
      ...won(2, StructureType.Rift, 666, null),
      { story: "RewardChestOpened", storyPayload: { amount: "128" }, timestampMs: at(5) },
    ];
    expect(dayBest(stories, 31)).toEqual({ kind: "chest", lords: 128 });
  });

  it("is the land revealed on a day with no clear", () => {
    expect(dayBest([{ story: "ExplorationReward", storyPayload: {}, timestampMs: at(1) }], 1)).toEqual({
      kind: "reveals",
      count: 1,
    });
  });
});
