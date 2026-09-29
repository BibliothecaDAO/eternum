import { describe, expect, it } from "vitest";

import { buildEntryHref, buildPlayHref, parseEntryRoute, parsePlayRoute } from "./play-route";

const createLocation = (pathname: string, search = ""): Location => ({ pathname, search }) as Location;

describe("play-route", () => {
  it("round-trips a scene route through its chain id and game id", () => {
    const route = parsePlayRoute(
      createLocation(
        "/g/0xA1/3/map",
        "?col=1&row=2&boot=map-first&resumeScene=hex&rendererMode=webgpu-force-webgl&logs=1",
      ),
    );
    expect(route).toMatchObject({ chainId: "0xa1", gameId: 3, scene: "map", col: 1, row: 2, resumeScene: "hex" });
    expect(buildPlayHref({ ...route!, scene: "hex", bootMode: "direct", resumeScene: null, spectate: true })).toBe(
      "/g/0xa1/3/hex?col=1&row=2&spectate=true&rendererMode=webgpu-force-webgl&logs=1",
    );
  });

  it("refuses a chain that is not a hex felt and a game id that is not a positive integer", () => {
    expect(parsePlayRoute(createLocation("/g/madara/3/map"))).toBeNull();
    expect(parseEntryRoute(createLocation("/g/0xa1/iron-age"))).toBeNull();
    expect(parseEntryRoute(createLocation("/g/0xa1/0"))).toBeNull();
  });

  it("tells a game's entry apart from its scenes", () => {
    expect(parseEntryRoute(createLocation("/g/0xb2/9", "?spectate=true"))).toEqual({
      chainId: "0xb2",
      gameId: 9,
      intent: "spectate",
      autoSettle: false,
    });
    expect(parseEntryRoute(createLocation("/g/0xb2/9/map"))).toBeNull();
    expect(parsePlayRoute(createLocation("/g/0xb2/9"))).toBeNull();
    expect(buildEntryHref({ chainId: "0xb2", gameId: 9, intent: "settle", autoSettle: true })).toBe(
      "/g/0xb2/9?intent=settle&autoSettle=true",
    );
    expect(buildEntryHref({ chainId: "0xa1", gameId: 3, intent: "spectate", autoSettle: false })).toBe(
      "/g/0xa1/3?spectate=true",
    );
  });
});
