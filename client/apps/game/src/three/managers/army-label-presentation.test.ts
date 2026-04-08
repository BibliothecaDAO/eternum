import { describe, expect, it, vi } from "vitest";

import { syncArmyLabelPresentationState } from "./army-label-presentation";

describe("syncArmyLabelPresentationState", () => {
  it("repositions the active label above the current army position", () => {
    const copy = vi.fn();
    const label = {
      position: {
        copy,
        y: 4,
      },
    };
    const position = { x: 1, y: 2, z: 3 };

    syncArmyLabelPresentationState({
      label: label as never,
      position,
    });

    expect(copy).toHaveBeenCalledWith(position);
    expect(label.position.y).toBe(5.5);
  });

  it("skips work when there is no active label", () => {
    expect(() =>
      syncArmyLabelPresentationState({
        label: undefined,
        position: { x: 1, y: 2, z: 3 },
      }),
    ).not.toThrow();
  });
});
