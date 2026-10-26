// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";

import { feedRuns, readFeedStory, type FeedReading } from "./feed-reading";
import { installRecordedGame, RECORDED_FEED, recordedStories } from "./recorded-feed";

/** Prod's recorded page, read as the lab reads it, every player named by their recorded public name. */
const named = new Map(Object.entries(RECORDED_FEED.names).map(([address, name]) => [BigInt(address), name]));
const names = { text: (address: string | bigint) => named.get(BigInt(address)) ?? "?" } as never;
let stories: ReturnType<typeof recordedStories>;
let readings: FeedReading[];
beforeAll(() => {
  const store = installRecordedGame();
  stories = recordedStories(store, names);
  readings = stories.map((story) => readFeedStory(story, store));
});
const nameOf = (address: string) => named.get(BigInt(address));
const byTitle = (title: string) => readings[stories.findIndex((story) => story.presentation.title === title)]!;

describe("the Feed's reading of prod's recorded page", () => {
  it("names who did it on every row: one of the page's 8 players", () => {
    expect(readings).toHaveLength(345);
    expect(readings.filter((reading) => nameOf(reading.actor) === undefined)).toEqual([]);
    expect(new Set(readings.map((reading) => nameOf(reading.actor))).size).toBe(8);
  });

  it("writes an exploration under one unit with no amount, as the owner asked ('djizus explored')", () => {
    const under = stories.filter(
      (story) => story.story === "ExplorationReward" && BigInt(String(story.storyPayload.amount)) < 1_000_000_000n,
    );
    expect(under).toHaveLength(54);
    for (const story of under) {
      // Today: "Explored: +<1 Labor", or a find's "Stormcrag found: +<1 Labor".
      expect(story.presentation.title).toMatch(/: \+<1 /);
      const reading = readFeedStory(story, installRecordedGame());
      expect(["explored", "found"]).toContain(reading.verb);
      expect(reading.reward).toBeUndefined();
    }
  });

  it("writes every reward whole, with no decimals", () => {
    const amounts = readings.flatMap((reading) => (reading.reward ? [reading.reward.amount] : []));
    expect(amounts).toHaveLength(186);
    // Whole units, or the house's compact thousands ("12.4K"); never a fraction of a unit, never "<1".
    expect(amounts.filter((amount) => /\.\d+$/.test(amount) || amount.includes("<"))).toEqual([]);
  });

  it("reads a fight as its attacker attacking the site's guard, its verdict as the story words it", () => {
    expect(byTitle("Krump vs Skullbite · Victory")).toMatchObject({
      verb: "attacked",
      act: "attack",
      object: { name: "Skullbite", icon: "beast-troll" },
      outcome: { word: "Victory", tone: "good" },
    });
    expect(nameOf(byTitle("Krump vs Skullbite · Victory").actor)).toBe("Krump");
  });

  it("reads a clear, an army raised, an attribute trained and a building, each with what it names", () => {
    expect(byTitle("Krump cleared Skullbite")).toMatchObject({
      verb: "cleared",
      object: { name: "Skullbite" },
      reward: { amount: "+500", name: "Labor" },
    });
    expect(byTitle("Army raised at Nrumnlontun")).toMatchObject({ verb: "raised an army", act: "deploy" });
    expect(byTitle("Logistics uncommon")).toMatchObject({
      verb: "trained",
      object: { name: "Logistics uncommon", icon: "order-skill" },
    });
    expect(byTitle("Farm built at Nrumnlontun")).toMatchObject({ verb: "built", object: { name: "Farm" } });
    expect(readings.filter((reading) => reading.words)).toEqual([]);
  });

  it("groups the page into 53 runs of a player's play, each run's explorations summed whole", () => {
    const runs = feedRuns(readings, stories);
    expect(runs).toHaveLength(53);
    expect(runs.reduce((sum, run) => sum + run.readings.length, 0)).toBe(345);
    expect(runs[0]).toMatchObject({
      explored: {
        count: 5,
        rewards: [
          { amount: "+1,317", name: "Labor" },
          { amount: "+300", name: "Essence" },
        ],
      },
    });
    for (const run of runs) for (const reading of run.readings) expect(reading.actor).toBe(run.actor);
  });
});
