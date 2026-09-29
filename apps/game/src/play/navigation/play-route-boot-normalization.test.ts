import { describe, expect, it } from "vitest";

import { normalizePlayBootLocation } from "./play-route-boot-normalization";

describe("normalizePlayBootLocation", () => {
  it("rewrites direct player hex routes into canonical map-first boot routes", () => {
    expect(
      normalizePlayBootLocation({ pathname: "/g/0xa1/3/hex", search: "?col=4&row=9" }, { worldmapReady: false }),
    ).toBe("/g/0xa1/3/map?col=4&row=9&boot=map-first&resumeScene=hex");
  });

  it("rewrites spectator hex routes into map-first boot routes too, keeping the spectate flag", () => {
    expect(
      normalizePlayBootLocation(
        { pathname: "/g/0xa1/3/hex", search: "?col=4&row=9&spectate=true" },
        { worldmapReady: false },
      ),
    ).toBe("/g/0xa1/3/map?col=4&row=9&spectate=true&boot=map-first&resumeScene=hex");
  });

  it("preserves an explicit renderer trial and its logs through local boot", () => {
    expect(
      normalizePlayBootLocation(
        { pathname: "/g/0xb2/9/hex", search: "?col=4&row=9&rendererMode=webgpu-force-webgl&logs=1" },
        { worldmapReady: false },
      ),
    ).toBe("/g/0xb2/9/map?col=4&row=9&boot=map-first&resumeScene=hex&rendererMode=webgpu-force-webgl&logs=1");
  });

  it("does not rewrite the handoff in progress back to the world map", () => {
    expect(
      normalizePlayBootLocation(
        { pathname: "/g/0xa1/3/hex", search: "?col=4&row=9&boot=map-first&resumeScene=hex" },
        { worldmapReady: true },
      ),
    ).toBeNull();
  });

  it("boots a handoff route loaded afresh from the world map, where it can complete", () => {
    expect(
      normalizePlayBootLocation(
        { pathname: "/g/0xa1/3/hex", search: "?col=4&row=9&boot=map-first&resumeScene=hex" },
        { worldmapReady: false },
      ),
    ).toBe("/g/0xa1/3/map?col=4&row=9&boot=map-first&resumeScene=hex");
  });
});
