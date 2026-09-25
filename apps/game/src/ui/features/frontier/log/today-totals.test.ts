import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { totalToday } from "./today-totals";

const whole = (amount: number) => String(BigInt(amount) * BigInt(RESOURCE_PRECISION));
const story = (name: string, payload: Record<string, unknown>, owner = "0x111", timestampMs = 5_000) => ({
  story: name,
  storyPayload: payload,
  owner,
  timestampMs,
});

describe("the player's day in totals", () => {
  it("adds up the player's own reveals, clears and chests within today", () => {
    const stories = [
      story("ExplorationReward", { resource_type: ResourcesIds.Essence, amount: whole(150) }),
      story("ExplorationReward", { resource_type: ResourcesIds.Labor, amount: whole(149) }),
      story("SitePayout", {
        kind: "Camp",
        reward: { Some: { resource_type: ResourcesIds.Labor, amount: whole(550) } },
      }),
      story("SitePayout", { kind: "FallenRealm", reward: null }),
      story("ChestReward", { kind: "Relic", quality: 1 }),
      // Another player's reveal, and one of yesterday's, count for nothing today.
      story("ExplorationReward", { resource_type: ResourcesIds.Essence, amount: whole(900) }, "0x222"),
      story("ExplorationReward", { resource_type: ResourcesIds.Essence, amount: whole(900) }, "0x111", 500),
    ];
    expect(totalToday(stories, "0x0111", { startMs: 1_000, endMs: 9_000 })).toEqual({
      reveals: 2,
      sitesCleared: 2,
      chests: 1,
      essence: 150,
      labor: 699,
    });
  });
});
