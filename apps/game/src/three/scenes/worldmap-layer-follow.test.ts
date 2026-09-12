import type { ArmySpatialProjectionChange } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it, vi } from "vitest";
import { followArmyLayerChange } from "./worldmap-layer-follow";

function setup() {
  let alt = false;
  let selectedId = 7;
  const input = {
    changes: [
      {
        entityId: 7,
        previous: { hexCoords: { alt: false, col: 100, row: 100 } },
        current: { entityId: 7, hexCoords: { alt: true, col: 100, row: 100 } },
      },
    ] as unknown as ArmySpatialProjectionChange[],
    getSelectedId: () => selectedId,
    getLayer: () => alt,
    isSceneActive: () => true,
    setLayer: vi.fn((value: boolean) => {
      alt = value;
    }),
    finishMovement: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(),
  };
  return {
    input,
    selectOther: () => {
      selectedId = 8;
    },
  };
}

describe("following an army through a spire", () => {
  it("switches on the projection crossing and selects only after the new layer renders", async () => {
    const { input } = setup();
    let finish!: () => void;
    input.refresh.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = followArmyLayerChange(input);
    expect(input.setLayer).toHaveBeenCalledWith(true);
    expect(input.finishMovement).toHaveBeenCalledWith(7);
    expect(input.select).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(input.select).toHaveBeenCalledWith(7);
    input.changes = input.changes.map((change) => ({
      ...change,
      previous: change.current,
      current: { ...change.current!, hexCoords: { ...change.current!.hexCoords, alt: false } },
    }));
    input.refresh.mockResolvedValue(undefined);
    await followArmyLayerChange(input);
    expect(input.setLayer).toHaveBeenLastCalledWith(false);
  });

  it("does not follow an unselected army", async () => {
    const { input, selectOther } = setup();
    selectOther();
    await followArmyLayerChange(input);
    expect(input.setLayer).not.toHaveBeenCalled();
  });

  it("preserves a manual selection made while the new layer loads", async () => {
    const { input, selectOther } = setup();
    input.refresh.mockImplementation(async () => {
      selectOther();
    });
    await followArmyLayerChange(input);
    expect(input.select).not.toHaveBeenCalled();
  });
});
