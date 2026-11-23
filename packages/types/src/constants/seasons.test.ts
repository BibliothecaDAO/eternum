import { describe, expect, it } from "vitest";
import { isSeasonGame, seasonGameName, testnetGameName } from "./seasons";

describe("the season mark", () => {
  it("is a Frontier game named by the calendar's frontier-<start>, and nothing else", () => {
    expect(isSeasonGame(seasonGameName(1_795_248_000))).toBe(true);
    expect(isSeasonGame("frontier-1792575960")).toBe(true);
    for (const name of [
      testnetGameName(1_795_867_200),
      "rehearsal-4x",
      "frontier-",
      "frontier-12a",
      "check-frontier-1",
      "x-frontier-1",
    ])
      expect(isSeasonGame(name)).toBe(false);
  });
});
