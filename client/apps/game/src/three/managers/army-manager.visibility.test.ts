import { describe, expect, it } from "vitest";
import { shouldArmyRemainVisibleInBounds } from "./army-visibility";

describe("army-manager movement visibility", () => {
  const bounds = {
    minCol: 0,
    maxCol: 48,
    minRow: 0,
    maxRow: 48,
  };

  it("keeps an army visible when destination is out of bounds but source is still inside", () => {
    expect(shouldArmyRemainVisibleInBounds({ col: 64, row: 64 }, bounds, { col: 48, row: 20 })).toBe(true);
  });

  it("hides an army when both destination and source are out of bounds", () => {
    expect(shouldArmyRemainVisibleInBounds({ col: 64, row: 64 }, bounds, { col: 60, row: 60 })).toBe(false);
  });

  it("keeps an army visible when destination is in bounds", () => {
    expect(shouldArmyRemainVisibleInBounds({ col: 24, row: 24 }, bounds, { col: -10, row: -10 })).toBe(true);
  });
});
