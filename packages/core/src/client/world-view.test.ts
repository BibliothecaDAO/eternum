import { describe, expect, it } from "vitest";

import schema from "../../../../contracts/l3/world-native/schema/schema.json";
import { worldView } from "./world-view";

describe("worldView", () => {
  it("names a view the deployed Games contract exposes", () => {
    expect(worldView(schema, "expedition_home_ring")).toBe("expedition_home_ring");
    expect(worldView(schema, "blitz_result")).toBe("blitz_result");
  });

  it("refuses a logic-class view that only a test fixture forwards", () => {
    expect(() => worldView(schema, "biome")).toThrow("World view biome is not exposed by the Games contract");
  });
});
