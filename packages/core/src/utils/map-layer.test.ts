import { describe, expect, it } from "vitest";

import { mapLayerToAlt, normalizeMapLayer } from "./map-layer";

describe("map layer helpers", () => {
  it("maps the world layer to the regular map", () => {
    expect(mapLayerToAlt("world")).toBe(false);
  });

  it("maps the ethereal layer to the alternate map", () => {
    expect(mapLayerToAlt("ethereal")).toBe(true);
  });

  it("normalizes boolean alt values into domain layer names", () => {
    expect(normalizeMapLayer(false)).toBe("world");
    expect(normalizeMapLayer(true)).toBe("ethereal");
  });
});
