import { describe, expect, it } from "vitest";

import {
  buildEntryHrefFromEntryContext,
  resolveEntryContextCacheKey,
  resolveEntryContextFromEntryRoute,
  resolveEntryContextFromLandingSelection,
  resolveEntryContextFromPlayRoute,
} from "./context";

const createLocation = (pathname: string, search = ""): Location => ({ pathname, search }) as Location;

describe("game-entry context", () => {
  it("resolves a canonical landing entry context from a landing world selection", () => {
    expect(
      resolveEntryContextFromLandingSelection({
        selection: { chainId: "0xb2", gameId: 9 },
        intent: "settle",
        autoSettle: true,
      }),
    ).toEqual({
      chainId: "0xb2",
      gameId: 9,
      intent: "settle",
      autoSettle: true,
      source: "landing",
    });
  });

  it("parses canonical entry routes into landing entry context", () => {
    expect(resolveEntryContextFromEntryRoute(createLocation("/g/0xa1/3", "?intent=settle&autoSettle=true"))).toEqual({
      chainId: "0xa1",
      gameId: 3,
      intent: "settle",
      autoSettle: true,
      source: "landing",
    });
  });

  it("parses canonical play routes into direct play context", () => {
    expect(resolveEntryContextFromPlayRoute(createLocation("/g/0xa1/3/map", "?spectate=true"))).toEqual({
      chainId: "0xa1",
      gameId: 3,
      intent: "spectate",
      autoSettle: false,
      source: "play-route",
    });
  });

  it("builds the entry href from the shared entry context", () => {
    const context = {
      chainId: "0xb2",
      gameId: 9,
      intent: "play" as const,
      autoSettle: false,
      source: "landing" as const,
    };

    expect(buildEntryHrefFromEntryContext(context)).toBe("/g/0xb2/9");
    expect(resolveEntryContextCacheKey(context)).toBe("0xb2:9");
  });
});
