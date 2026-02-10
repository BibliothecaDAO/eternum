import { describe, expect, it } from "vitest";
import { resolveArmyTabSelectionPosition } from "./worldmap-army-tab-selection";

describe("resolveArmyTabSelectionPosition", () => {
  it("prefers rendered army position when available", () => {
    const position = resolveArmyTabSelectionPosition({
      renderedArmyPosition: { col: 12, row: -7 },
      selectableArmyNormalizedPosition: { col: 4, row: 2 },
    });

    expect(position).toEqual({ col: 12, row: -7 });
  });

  it("uses normalized selectable army position when rendered position is unavailable", () => {
    const position = resolveArmyTabSelectionPosition({
      renderedArmyPosition: undefined,
      selectableArmyNormalizedPosition: { col: 6, row: -2 },
    });

    expect(position).toEqual({ col: 6, row: -2 });
  });

  it("keeps normalized selectable army position unchanged", () => {
    const position = resolveArmyTabSelectionPosition({
      renderedArmyPosition: undefined,
      selectableArmyNormalizedPosition: { col: -3, row: 9 },
    });

    expect(position).toEqual({ col: -3, row: 9 });
  });
});
