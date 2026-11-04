import type { ArmySpatialProjectionChange } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it, vi } from "vitest";
import { followArmyCrossing } from "./worldmap-layer-follow";

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
    // A crossing as isArmyCrossing reads it: another layer, or another 10-row region on the same one.
    isCrossing: (from: { alt: boolean; row: number }, to: { alt: boolean; row: number }) =>
      from.alt !== to.alt || Math.floor(from.row / 10) !== Math.floor(to.row / 10),
    setLayer: vi.fn((value: boolean) => {
      alt = value;
    }),
    lookThrough: vi.fn().mockResolvedValue(undefined),
    finishMovement: vi.fn(),
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
  it("switches on the projection crossing and selects only once the view has passed into the new layer", async () => {
    const { input } = setup();
    let finish!: () => void;
    input.lookThrough.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = followArmyCrossing(input);
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
    input.lookThrough.mockResolvedValue(undefined);
    await followArmyCrossing(input);
    expect(input.setLayer).toHaveBeenLastCalledWith(false);
  });

  it("passes the view through the spire from the army's old tile to its arrival a region down", async () => {
    const { input } = setup();
    // enter_depth: the same layer, a region down the map.
    input.changes = [
      {
        entityId: 7,
        previous: { hexCoords: { alt: false, col: 100, row: 101 } },
        current: { entityId: 7, hexCoords: { alt: false, col: 100, row: 111 } },
      },
    ] as unknown as ArmySpatialProjectionChange[];
    await followArmyCrossing(input);
    expect(input.finishMovement).toHaveBeenCalledWith(7);
    expect(input.setLayer).toHaveBeenCalledWith(false);
    expect(input.lookThrough).toHaveBeenCalledWith(
      { alt: false, col: 100, row: 101 },
      { alt: false, col: 100, row: 111 },
    );
    expect(input.select).toHaveBeenCalledWith(7);
  });

  it("leaves the view alone for a walk inside a region", async () => {
    const { input } = setup();
    input.changes = [
      {
        entityId: 7,
        previous: { hexCoords: { alt: false, col: 100, row: 101 } },
        current: { entityId: 7, hexCoords: { alt: false, col: 101, row: 102 } },
      },
    ] as unknown as ArmySpatialProjectionChange[];
    await followArmyCrossing(input);
    expect(input.finishMovement).not.toHaveBeenCalled();
    expect(input.setLayer).not.toHaveBeenCalled();
    expect(input.lookThrough).not.toHaveBeenCalled();
  });

  it("does not follow an unselected army", async () => {
    const { input, selectOther } = setup();
    selectOther();
    await followArmyCrossing(input);
    expect(input.setLayer).not.toHaveBeenCalled();
  });

  it("preserves a manual selection made while the view passes into the new layer", async () => {
    const { input, selectOther } = setup();
    input.lookThrough.mockImplementation(async () => {
      selectOther();
    });
    await followArmyCrossing(input);
    expect(input.select).not.toHaveBeenCalled();
  });
});
