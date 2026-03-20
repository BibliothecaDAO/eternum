import { describe, expect, it } from "vitest";
import { resolveArmyPointLabelSize } from "./army-point-label-policy";

describe("resolveArmyPointLabelSize", () => {
  it("keeps army shield point-label icons below the old oversized scale", () => {
    expect(resolveArmyPointLabelSize()).toBe(32);
  });
});
