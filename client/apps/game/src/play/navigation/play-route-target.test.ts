// @vitest-environment node

import { configManager } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { resolvePlayRouteTarget } from "./play-route-target";

const createLocation = (pathname: string, search = ""): Pick<Location, "pathname" | "search"> => ({
  pathname,
  search,
});

configManager.mapCenter = 2010831280;

describe("resolvePlayRouteTarget", () => {
  it("resolves canonical map routes with a world-position camera target", () => {
    expect(
      resolvePlayRouteTarget(createLocation("/play/sepolia/aurora/map", "?col=12&row=34"), { fastTravelEnabled: true }),
    ).toEqual({
      scene: "map",
      requestedScene: "map",
      routeWorldPosition: { col: 12, row: 34 },
      hexRealmPosition: null,
      hexCameraTarget: null,
      spectate: false,
      isCanonical: true,
      playRoute: {
        bootMode: "direct",
        chain: "sepolia",
        worldName: "aurora",
        scene: "map",
        col: 12,
        row: 34,
        resumeScene: null,
        spectate: false,
      },
    });
  });

  it("resolves canonical hex routes to a realm target while keeping a keep-centered local camera", () => {
    expect(
      resolvePlayRouteTarget(createLocation("/play/sepolia/aurora/hex", "?col=4&row=9"), { fastTravelEnabled: true }),
    ).toEqual({
      scene: "hex",
      requestedScene: "hex",
      routeWorldPosition: { col: 4, row: 9 },
      hexRealmPosition: { col: expect.any(Number), row: expect.any(Number) },
      hexCameraTarget: "keep-center",
      spectate: false,
      isCanonical: true,
      playRoute: {
        bootMode: "direct",
        chain: "sepolia",
        worldName: "aurora",
        scene: "hex",
        col: 4,
        row: 9,
        resumeScene: null,
        spectate: false,
      },
    });
  });

  it("falls back disabled travel routes to the world map while preserving their route coordinates", () => {
    expect(
      resolvePlayRouteTarget(createLocation("/play/sepolia/aurora/travel", "?col=7&row=11"), {
        fastTravelEnabled: false,
      }),
    ).toEqual({
      scene: "map",
      requestedScene: "travel",
      routeWorldPosition: { col: 7, row: 11 },
      hexRealmPosition: null,
      hexCameraTarget: null,
      spectate: false,
      isCanonical: true,
      playRoute: {
        bootMode: "direct",
        chain: "sepolia",
        worldName: "aurora",
        scene: "travel",
        col: 7,
        row: 11,
        resumeScene: null,
        spectate: false,
      },
    });
  });

  it("keeps travel routes on travel when fast travel is enabled", () => {
    expect(
      resolvePlayRouteTarget(createLocation("/play/sepolia/aurora/travel", "?col=7&row=11"), {
        fastTravelEnabled: true,
      }),
    ).toEqual({
      scene: "travel",
      requestedScene: "travel",
      routeWorldPosition: { col: 7, row: 11 },
      hexRealmPosition: null,
      hexCameraTarget: null,
      spectate: false,
      isCanonical: true,
      playRoute: {
        bootMode: "direct",
        chain: "sepolia",
        worldName: "aurora",
        scene: "travel",
        col: 7,
        row: 11,
        resumeScene: null,
        spectate: false,
      },
    });
  });

  it("preserves spectate mode while leaving missing coordinates null", () => {
    expect(
      resolvePlayRouteTarget(createLocation("/play/sepolia/aurora/map", "?spectate=true"), { fastTravelEnabled: true }),
    ).toEqual({
      scene: "map",
      requestedScene: "map",
      routeWorldPosition: null,
      hexRealmPosition: null,
      hexCameraTarget: null,
      spectate: true,
      isCanonical: true,
      playRoute: {
        bootMode: "direct",
        chain: "sepolia",
        worldName: "aurora",
        scene: "map",
        col: null,
        row: null,
        resumeScene: null,
        spectate: true,
      },
    });
  });

  it("normalizes contract-space route coordinates into canonical world-map positions", () => {
    const routeWorldPosition = resolvePlayRouteTarget(
      createLocation("/play/slot/bltz-spark-702/map", "?col=2010831286&row=2010831278"),
      { fastTravelEnabled: true },
    ).routeWorldPosition;

    expect(routeWorldPosition).toEqual({ col: 6, row: -2 });
  });

  it("returns a non-canonical fallback when the location is not a canonical play route", () => {
    expect(resolvePlayRouteTarget(createLocation("/play/map", "?col=1&row=2"), { fastTravelEnabled: true })).toEqual({
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
