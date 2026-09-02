import { describe, expect, it } from "vitest";

import { normalizePlayBootLocation } from "./play-route-boot-normalization";

describe("normalizePlayBootLocation", () => {
  it("rewrites direct player hex routes into canonical map-first boot routes", () => {
    expect(
      normalizePlayBootLocation({
        pathname: "/play/appchain/aurora-blitz/hex",
        search: "?col=4&row=9",
      }),
    ).toBe("/play/appchain/aurora-blitz/map?col=4&row=9&boot=map-first&resumeScene=hex");
  });

  it("rewrites spectator hex routes into map-first boot routes too, keeping the spectate flag", () => {
    expect(
      normalizePlayBootLocation({
        pathname: "/play/appchain/aurora-blitz/hex",
        search: "?col=4&row=9&spectate=true",
      }),
    ).toBe("/play/appchain/aurora-blitz/map?col=4&row=9&spectate=true&boot=map-first&resumeScene=hex");
  });

  it("does not rewrite in-progress map-first handoff routes back to the world map", () => {
    expect(
      normalizePlayBootLocation({
        pathname: "/play/appchain/aurora-blitz/hex",
        search: "?col=4&row=9&boot=map-first&resumeScene=hex",
      }),
    ).toBeNull();
  });
});
