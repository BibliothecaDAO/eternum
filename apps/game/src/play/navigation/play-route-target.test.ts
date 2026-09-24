// @vitest-environment node

import { configManager } from "@bibliothecadao/eternum";
import { describe, expect, it, vi } from "vitest";

import { resolvePlayRouteTarget } from "./play-route-target";

const createLocation = (pathname: string, search = ""): Pick<Location, "pathname" | "search"> => ({
  pathname,
  search,
});

vi.spyOn(configManager, "getMapCenter").mockReturnValue(2010831280);

describe("resolvePlayRouteTarget", () => {
  it("resolves canonical map routes with a world-position camera target", () => {
    expect(resolvePlayRouteTarget(createLocation("/g/0xa1/3/map", "?col=12&row=34"))).toEqual({
      scene: "map",
      requestedScene: "map",
      routeWorldPosition: { col: 12, row: 34 },
      hexRealmPosition: null,
      hexCameraTarget: null,
      spectate: false,
      isCanonical: true,
      playRoute: {
        bootMode: "direct",
        chainId: "0xa1",
        gameId: 3,
        scene: "map",
        col: 12,
        row: 34,
        resumeScene: null,
      },
    });
  });

  it("resolves canonical hex routes to a realm target while keeping a keep-centered local camera", () => {
    expect(resolvePlayRouteTarget(createLocation("/g/0xa1/3/hex", "?col=4&row=9"))).toEqual({
      scene: "hex",
      requestedScene: "hex",
      routeWorldPosition: { col: 4, row: 9 },
      hexRealmPosition: { col: expect.any(Number), row: expect.any(Number) },
      hexCameraTarget: "keep-center",
      spectate: false,
      isCanonical: true,
      playRoute: {
        bootMode: "direct",
        chainId: "0xa1",
        gameId: 3,
        scene: "hex",
        col: 4,
        row: 9,
        resumeScene: null,
      },
    });
  });

  it("preserves spectate mode while leaving missing coordinates null", () => {
    expect(resolvePlayRouteTarget(createLocation("/g/0xa1/3/map", "?spectate=true"))).toEqual({
      scene: "map",
      requestedScene: "map",
      routeWorldPosition: null,
      hexRealmPosition: null,
      hexCameraTarget: null,
      spectate: true,
      isCanonical: true,
      playRoute: {
        bootMode: "direct",
        chainId: "0xa1",
        gameId: 3,
        scene: "map",
        col: null,
        row: null,
        resumeScene: null,
      },
    });
  });

  it("reads a map URL's hex as written, whatever its distance from the map centre", () => {
    expect(resolvePlayRouteTarget(createLocation("/g/0xa1/702/map", "?col=6&row=-2")).routeWorldPosition).toEqual({
      col: 6,
      row: -2,
    });
    // A Frontier site lies about 2^31 hexes from the centre; its normalized hex is not mistaken for a contract one.
    expect(
      resolvePlayRouteTarget(createLocation("/g/0xa1/1/map", "?col=-2010817430&row=-2010811630")).routeWorldPosition,
    ).toEqual({ col: -2010817430, row: -2010811630 });
  });

  it("returns a non-canonical fallback when the location is not a canonical play route", () => {
    expect(resolvePlayRouteTarget(createLocation("/play/map", "?col=1&row=2"))).toEqual({
      scene: "map",
      requestedScene: null,
      routeWorldPosition: null,
      hexRealmPosition: null,
      hexCameraTarget: null,
      spectate: false,
      isCanonical: false,
      playRoute: null,
    });
  });
});
