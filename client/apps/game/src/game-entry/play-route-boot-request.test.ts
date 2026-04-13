import { describe, expect, it } from "vitest";

import { resolvePlayBootRequest } from "./play-route-boot-request";

describe("resolvePlayBootRequest", () => {
  it("drops map-first travel handoff when fast travel is disabled", () => {
    expect(
      resolvePlayBootRequest(
        {
          pathname: "/play/slot/blitz-world/map",
          search: "?col=12&row=34&boot=map-first&resumeScene=travel",
        },
        { fastTravelEnabled: false },
      ),
    ).toEqual({
      bootScene: "map",
      chain: "slot",
      entryMode: "player",
      fallbackPolicy: "route",
      requestedScene: "travel",
      resumeScene: null,
      routeWorldPosition: { col: 12, row: 34 },
      worldName: "blitz-world",
    });
  });
});
