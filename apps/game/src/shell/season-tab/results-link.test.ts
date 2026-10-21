import { describe, expect, it } from "vitest";

import { gameOfResults, resultsHref } from "./results-link";

describe("a Results address", () => {
  it("names a game by its chain and id", () => {
    expect(resultsHref({ chainId: "0xa", gameId: 7 })).toBe("/results/0xa-7");
    expect(gameOfResults("0xa-7")).toEqual({ chainId: "0xa", gameId: 7 });
  });

  it("names no game for an address that is not one", () => {
    expect(gameOfResults("0x111")).toBeNull();
    expect(gameOfResults(undefined)).toBeNull();
  });
});
