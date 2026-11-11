import { describe, expect, it } from "vitest";

import { mapClientAsked, mapClientFor } from "./map-client-flag";

describe("mapClientFor", () => {
  it("opens the map with the map client on a dev build, and with the current renderer on a production build", () => {
    expect(mapClientFor("", true)).toBe("next");
    expect(mapClientFor("?spectate=true", true)).toBe("next");
    expect(mapClientFor("", false)).toBe("current");
    expect(mapClientFor("?spectate=true", false)).toBe("current");
  });

  it("gives an address the renderer it asks for by name, whatever the build", () => {
    expect(mapClientFor("?mapClient=current", true)).toBe("current");
    expect(mapClientFor("?mapClient=next", false)).toBe("next");
    expect(mapClientFor("?spectate=true&mapClient=next&rendererMode=webgpu-force-webgl", false)).toBe("next");
  });

  it("takes a name that is no renderer's as no ask at all", () => {
    expect(mapClientAsked("?mapClient=anything")).toBeNull();
    expect(mapClientFor("?mapClient=anything", false)).toBe("current");
    expect(mapClientFor("?mapClient=anything", true)).toBe("next");
  });
});
