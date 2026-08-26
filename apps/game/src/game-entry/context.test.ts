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
        selection: { name: "iron-age", chain: "madara", worldAddress: "0x1" },
        intent: "settle",
        autoSettle: true,
      }),
    ).toEqual({
      chain: "madara",
      worldName: "iron-age",
      worldAddress: "0x1",
      intent: "settle",
      autoSettle: true,
      source: "landing",
    });
  });

  it("accepts both phase-one game chains", () => {
    expect(
      resolveEntryContextFromLandingSelection({
        selection: { name: "appchain-dev", chain: "appchain" },
        intent: "play",
      }),
    ).toEqual({
      chain: "appchain",
      worldName: "appchain-dev",
      intent: "play",
      autoSettle: false,
      source: "landing",
    });
    expect(isLandingPrimaryChain("madara")).toBe(true);
    expect(isLandingPrimaryChain("appchain")).toBe(true);
  });

  it("parses canonical entry routes into landing entry context", () => {
    expect(
      resolveEntryContextFromEntryRoute(
        createLocation("/enter/appchain/aurora-blitz", "?intent=settle&autoSettle=true"),
      ),
    ).toEqual({
      chain: "appchain",
      worldName: "aurora-blitz",
      intent: "settle",
      autoSettle: true,
      source: "landing",
    });
  });

  it("parses canonical play routes into direct play context", () => {
    expect(resolveEntryContextFromPlayRoute(createLocation("/play/madara/aurora-blitz/map", "?spectate=true"))).toEqual(
      {
        chain: "madara",
        worldName: "aurora-blitz",
        intent: "spectate",
        autoSettle: false,
        source: "play-route",
      },
    );
  });

  it("builds entry and play hrefs from the shared entry context", () => {
    const context = {
      chain: "madara" as const,
      worldName: "iron-age",
      intent: "play" as const,
      autoSettle: false,
      source: "landing" as const,
    };

    expect(buildEntryHrefFromEntryContext(context)).toBe("/enter/madara/iron-age");
    expect(buildPlayRouteFromEntryContext({ context })).toBe("/play/madara/iron-age/hex");
    expect(
      buildPlayRouteFromEntryContext({
        context: { ...context, intent: "spectate" },
        col: 4,
        row: 9,
      }),
    ).toBe("/play/madara/iron-age/map?col=4&row=9&spectate=true");
    expect(resolveEntryContextCacheKey(context)).toBe("madara:iron-age");
  });
});
