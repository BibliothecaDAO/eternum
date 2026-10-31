import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { shrineRewardAt } from "./use-site";
import { reloadSiteFacts, sitesBeside, FAR_SHRINE_TILE } from "./site-fixture";
import { describe, expect, it } from "vitest";
import { mapSiteKind, siteGain, siteGainLine } from "./map-site-plan";

describe("a Shrine or Well", () => {
  it("is read from its tile's occupier alone", () => {
    expect(mapSiteKind(40)).toBe("Shrine");
    expect(mapSiteKind(41)).toBe("Well");
    expect(mapSiteKind(37)).toBeNull();
  });

  it("reads the stored Shrine rank and the rule’s stamina at a Well", () => {
    expect(siteGain("Shrine", { game_id: 1, entity_id: 901n, rank: 3 })).toBe(3);
    expect(siteGain("Shrine", undefined)).toBeUndefined();
    expect(siteGain("Well", { game_id: 1, entity_id: 901n, rank: 3 })).toBe(60);
    expect(siteGain("Well", undefined)).toBe(60);
  });
});

it("recovers the distant Shrine's exact reward from a cold snapshot", () => {
  const { store } = sitesBeside(40n);
  const restored = reloadSiteFacts(store);
  expect(restored).toBeInstanceOf(NativeFactStore);
  const reward = shrineRewardAt(restored, FAR_SHRINE_TILE);
  expect(siteGainLine("Shrine", siteGain("Shrine", reward), undefined)).toBe("V skill point");
});

it("refuses an invalid stored rank", () => {
  expect(() => siteGain("Shrine", { game_id: 1, entity_id: 901n, rank: 0 })).toThrow("Invalid rank");
});
