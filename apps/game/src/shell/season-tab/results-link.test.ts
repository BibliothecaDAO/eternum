import { describe, expect, it } from "vitest";

import { gameOfResults, isFromList, resultsHref } from "./results-link";

describe("a Results address", () => {
  it("names a game by its chain and id, and marks one opened from a list", () => {
    expect(resultsHref({ chainId: "0xa", game_id: 7 }, false)).toBe("/results/0xa-7");
    expect(resultsHref({ chainId: "0xa", game_id: 7 }, true)).toBe("/results/0xa-7?from=list");
    expect(gameOfResults("0xa-7")).toEqual({ chainId: "0xa", gameId: 7 });
    expect(isFromList("?from=list")).toBe(true);
    expect(isFromList("")).toBe(false);
  });

  it("names no game for an address that is not one", () => {
    expect(gameOfResults("0x111")).toBeNull();
    expect(gameOfResults(undefined)).toBeNull();
  });
});
