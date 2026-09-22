import { describe, expect, it } from "vitest";

import { normalizePlayBootLocation } from "./play-route-boot-normalization";

describe("normalizePlayBootLocation", () => {
  it("rewrites direct player hex routes into canonical map-first boot routes", () => {
    expect(
      normalizePlayBootLocation({
        pathname: "/play/0xa1/3/hex",
        search: "?col=4&row=9",
      }),
    ).toBe("/play/0xa1/3/map?col=4&row=9&boot=map-first&resumeScene=hex");
  });

  it("rewrites spectator hex routes into map-first boot routes too, keeping the spectate flag", () => {
    expect(
      normalizePlayBootLocation({
        pathname: "/play/0xa1/3/hex",
        search: "?col=4&row=9&spectate=true",
      }),
    ).toBe("/play/0xa1/3/map?col=4&row=9&spectate=true&boot=map-first&resumeScene=hex");
  });

  it("preserves an explicit renderer trial and its logs through local boot", () => {
    expect(
      normalizePlayBootLocation({
        pathname: "/play/0xb2/9/hex",
        search: "?col=4&row=9&rendererMode=webgpu-force-webgl&logs=1",
      }),
    ).toBe("/play/0xb2/9/map?col=4&row=9&boot=map-first&resumeScene=hex&rendererMode=webgpu-force-webgl&logs=1");
  });

  it("does not rewrite in-progress map-first handoff routes back to the world map", () => {
    expect(
      normalizePlayBootLocation({
        pathname: "/play/0xa1/3/hex",
        search: "?col=4&row=9&boot=map-first&resumeScene=hex",
      }),
    ).toBeNull();
  });
});
