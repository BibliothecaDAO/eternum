import { describe, expect, it } from "vitest";

import {
  buildEntryHrefFromEntryContext,
  buildPlayRouteFromEntryContext,
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

  it("builds entry and play hrefs from the shared entry context", () => {
    const context = {
      chainId: "0xb2",
      gameId: 9,
      intent: "play" as const,
      autoSettle: false,
      source: "landing" as const,
    };

    expect(buildEntryHrefFromEntryContext(context)).toBe("/g/0xb2/9");
    expect(buildPlayRouteFromEntryContext({ context })).toBe("/g/0xb2/9/hex");
    expect(
      buildPlayRouteFromEntryContext({
        context: { ...context, intent: "spectate" },
        col: 4,
        row: 9,
      }),
    ).toBe("/g/0xb2/9/map?col=4&row=9&spectate=true");
    expect(resolveEntryContextCacheKey(context)).toBe("0xb2:9");
  });
});
