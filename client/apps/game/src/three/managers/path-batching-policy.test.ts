import { Color, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { resolvePathBatches } from "./path-batching-policy";
import type { ArmyPath } from "../types/path";

function createPath(entityId: number, segmentCount: number, displayState: ArmyPath["displayState"]): ArmyPath {
  const segments = Array.from({ length: segmentCount }, (_, index) => ({
    direction: new Vector3(1, 0, 0),
    end: new Vector3(index + 1, 0, 0),
    length: 1,
    start: new Vector3(index, 0, 0),
  }));

  return {
    boundingBox: { clone: () => ({}) } as never,
    color: new Color("#ffffff"),
    displayState,
    entityId,
    progress: 0,
    segmentCount,
    segments,
    startIndex: 0,
    totalLength: segmentCount,
  };
}

describe("resolvePathBatches", () => {
  it("groups multiple paths into a bounded number of display-state batches", () => {
    const result = resolvePathBatches(
      [
        createPath(1, 3, "moving"),
        createPath(2, 2, "moving"),
        createPath(3, 1, "selected"),
      ],
      4,
    );

    expect(result).toEqual([
      {
        displayState: "moving",
        entityIds: [1],
        segmentCount: 3,
      },
      {
        displayState: "moving",
        entityIds: [2],
        segmentCount: 2,
      },
      {
        displayState: "selected",
        entityIds: [3],
        segmentCount: 1,
      },
    ]);
  });
});
