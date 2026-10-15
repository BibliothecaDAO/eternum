import { describe, expect, it } from "vitest";

import { gameAddresses, linesBetween, relicsMissingFromLog, spiralPoints } from "./prove-play-game.mjs";
import { parseArgs } from "./prove-play.mjs";

describe("a game's proof", () => {
  it("holds each step to the game's own addresses", () => {
    expect(gameAddresses("0xa:7")).toEqual({ doorway: "/g/0xa/7", map: "/g/0xa/7/map", results: "/results/0xa-7" });
    expect(() => gameAddresses("0xa")).toThrow("--game expects <chain>:<game>");
  });

  it("needs a signed-in profile for a game", () => {
    expect(() => parseArgs(["--game", "0xa:7"])).toThrow("--game needs --profile");
    expect(
      parseArgs(["--game", "0xa:7", "--profile", "/p", "--crate", "3,11", "--until-end", "40", "--ended"]),
    ).toMatchObject({
      game: "0xa:7",
      profile: "/p",
      crate: [3, 11],
      untilEndMinutes: 40,
      ended: true,
    });
  });

  it("reads a crate's relics off its panel and finds the ones the log does not name", () => {
    const panel = "Relic Tile · (3, 11)\nCrate opened\nContents\nDamage Relic II\nStamina Relic I\nBiome\nBare";
    const opened = linesBetween(panel, "Contents", "Biome");
    expect(opened).toEqual(["Damage Relic II", "Stamina Relic I"]);
    expect(relicsMissingFromLog(opened, "Stolsli T1 army · Damage Relic II, Stamina Relic I")).toEqual([]);
    expect(relicsMissingFromLog(opened, "Stolsli T1 army · Damage Relic 2, Stamina Relic 1")).toEqual(opened);
  });

  it("moves the pointer outward from the tile the map opens on", () => {
    const points = spiralPoints([720, 450], { radius: 40, step: 40 });
    expect(points[0]).toEqual([720, 450]);
    expect(points).toHaveLength(9);
  });
});
