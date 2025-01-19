import { describe, expect, it } from "vitest";
import { HYPERSTRUCTURE_CREATION_COSTS } from "../constants";

describe("RESOURCE_PRODUCTION_INPUT_RESOURCES", () => {
  it("should be defined", () => {
    console.log("HYPERSTRUCTURE_CREATION_COSTS:", HYPERSTRUCTURE_CREATION_COSTS);
    expect(HYPERSTRUCTURE_CREATION_COSTS).toBeDefined();
    expect(HYPERSTRUCTURE_CREATION_COSTS).not.toBeNull();
  });
});
