import { describe, expect, it } from "vitest";
import { resolveArmyVisibilityBoundsDecision, shouldArmyRemainVisibleInBounds } from "./army-visibility";

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

  it("treats min/max bounds as inclusive for destination and source", () => {
    expect(shouldArmyRemainVisibleInBounds({ col: 0, row: 0 }, bounds)).toBe(true);
    expect(shouldArmyRemainVisibleInBounds({ col: 48, row: 48 }, bounds)).toBe(true);
    expect(shouldArmyRemainVisibleInBounds({ col: 64, row: 64 }, bounds, { col: 0, row: 48 })).toBe(true);
  });
});

describe("resolveArmyVisibilityBoundsDecision", () => {
  const bounds = {
    minCol: 0,
    maxCol: 48,
    minRow: 0,
    maxRow: 48,
  };

  it("returns destination when destination is inside bounds", () => {
    const decision = resolveArmyVisibilityBoundsDecision({
      destination: { col: 12, row: 9 },
      bounds,
      source: { col: 99, row: 99 },
    });

    expect(decision).toEqual({
      shouldRemainVisible: true,
      visibleBy: "destination",
    });
  });

  it("returns source when destination is outside but source is inside bounds", () => {
    const decision = resolveArmyVisibilityBoundsDecision({
      destination: { col: 99, row: 99 },
      bounds,
      source: { col: 10, row: 10 },
    });

    expect(decision).toEqual({
      shouldRemainVisible: true,
      visibleBy: "source",
    });
  });

  it("returns none when neither destination nor source is in bounds", () => {
    const decision = resolveArmyVisibilityBoundsDecision({
      destination: { col: 99, row: 99 },
      bounds,
      source: { col: 80, row: 80 },
    });

    expect(decision).toEqual({
      shouldRemainVisible: false,
      visibleBy: "none",
    });
  });

  it("returns none when destination is outside and source is missing", () => {
    const decision = resolveArmyVisibilityBoundsDecision({
      destination: { col: 99, row: 99 },
      bounds,
    });

    expect(decision).toEqual({
      shouldRemainVisible: false,
      visibleBy: "none",
    });
  });
});
