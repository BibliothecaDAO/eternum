import { describe, expect, it } from "vitest";

import {
  buildEntryHrefFromEntryContext,
  buildPlayRouteFromEntryContext,
  isLandingPrimaryChain,
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
        selection: { name: "iron-age", chain: "mainnet", worldAddress: "0x1" },
        intent: "forge",
        autoSettle: true,
        hyperstructuresLeft: 2,
      }),
    ).toEqual({
      chain: "mainnet",
      worldName: "iron-age",
      worldAddress: "0x1",
      intent: "forge",
      autoSettle: true,
      hyperstructuresLeft: 2,
      source: "landing",
    });
  });

  it("rejects non-primary landing chains while still accepting direct play routes", () => {
    expect(
      resolveEntryContextFromLandingSelection({
        selection: { name: "local-dev", chain: "local" },
        intent: "play",
      }),
    ).toBeNull();
    expect(isLandingPrimaryChain("mainnet")).toBe(true);
    expect(isLandingPrimaryChain("slot")).toBe(true);
    expect(isLandingPrimaryChain("local")).toBe(false);
  });

  it("parses canonical entry routes into landing entry context", () => {
    expect(
      resolveEntryContextFromEntryRoute(
        createLocation("/enter/slot/aurora-blitz", "?intent=settle&hyperstructuresLeft=5&autoSettle=true"),
      ),
    ).toEqual({
      chain: "slot",
      worldName: "aurora-blitz",
      intent: "settle",
      autoSettle: true,
      hyperstructuresLeft: 5,
      source: "landing",
    });
  });

  it("parses canonical play routes into direct play context", () => {
    expect(resolveEntryContextFromPlayRoute(createLocation("/play/sepolia/aurora-blitz/map", "?spectate=true"))).toEqual({
      chain: "sepolia",
      worldName: "aurora-blitz",
      intent: "spectate",
      autoSettle: false,
      hyperstructuresLeft: null,
      source: "play-route",
    });
  });

  it("builds entry and play hrefs from the shared entry context", () => {
    const context = {
      chain: "mainnet" as const,
      worldName: "iron-age",
      intent: "play" as const,
      autoSettle: false,
      hyperstructuresLeft: null,
      source: "landing" as const,
    };

    expect(buildEntryHrefFromEntryContext(context)).toBe("/enter/mainnet/iron-age");
    expect(buildPlayRouteFromEntryContext({ context })).toBe("/play/mainnet/iron-age/hex");
    expect(
      buildPlayRouteFromEntryContext({
        context: { ...context, intent: "spectate" },
        col: 4,
        row: 9,
      }),
    ).toBe("/play/mainnet/iron-age/map?col=4&row=9&spectate=true");
    expect(resolveEntryContextCacheKey(context)).toBe("mainnet:iron-age");
  });
});
