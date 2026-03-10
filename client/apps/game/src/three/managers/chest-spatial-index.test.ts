import { describe, expect, it, vi } from "vitest";
import { type IndexedChestLike, ChestSpatialIndex, collectVisibleChestsForChunk } from "./chest-spatial-index";
import { getRenderBounds } from "../utils/chunk-geometry";

function createChest(entityId: number, col: number, row: number): IndexedChestLike {
  return {
    entityId,
    hexCoords: {
      getNormalized: () => ({ x: col, y: row }),
    },
  };
}

function isLegacyVisible(
  chest: IndexedChestLike,
  startRow: number,
  startCol: number,
  renderChunkSize: { width: number; height: number },
  chunkStride: number,
): boolean {
  const { x, y } = chest.hexCoords.getNormalized();
  const { minCol, maxCol, minRow, maxRow } = getRenderBounds(startRow, startCol, renderChunkSize, chunkStride);

  return x >= minCol && x <= maxCol && y >= minRow && y <= maxRow;
}

describe("ChestSpatialIndex", () => {
  it("matches the legacy visible chest result set for a chunk", () => {
    const renderChunkSize = { width: 2, height: 2 };
    const chunkStride = 4;
    const chests = new Map<number, IndexedChestLike>([
      [1, createChest(1, 1, 1)],
      [2, createChest(2, 2, 1)],
      [3, createChest(3, 1, 2)],
      [4, createChest(4, 8, 8)],
      [5, createChest(5, -3, -1)],
    ]);
    const index = new ChestSpatialIndex<number>(chunkStride);

    chests.forEach((chest, entityId) => {
      index.upsert(entityId, undefined, chest.hexCoords);
    });

    const indexed = collectVisibleChestsForChunk({
      chests,
      index,
      startRow: 0,
      startCol: 0,
      renderChunkSize,
      chunkStride,
    }).map((chest) => chest.entityId);

    const legacy = Array.from(chests.values())
      .filter((chest) => isLegacyVisible(chest, 0, 0, renderChunkSize, chunkStride))
      .map((chest) => chest.entityId);

    expect(indexed).toEqual(legacy);
  });

  it("checks only bucket candidates instead of the full chest table", () => {
    const renderChunkSize = { width: 2, height: 2 };
    const chunkStride = 4;
    const chests = new Map<number, IndexedChestLike>();
    const index = new ChestSpatialIndex<number>(chunkStride);

    const inChunk = [createChest(1, 1, 1), createChest(2, 2, 1), createChest(3, 1, 2)];
    const offscreen = Array.from({ length: 50 }, (_, offset) => createChest(offset + 100, 40 + offset, 40 + offset));

    [...inChunk, ...offscreen].forEach((chest) => {
      chests.set(chest.entityId, chest);
      index.upsert(chest.entityId, undefined, chest.hexCoords);
    });

    const isVisible = vi.fn((chest: IndexedChestLike) => isLegacyVisible(chest, 0, 0, renderChunkSize, chunkStride));

    const visible = collectVisibleChestsForChunk({
      chests,
      index,
      startRow: 0,
      startCol: 0,
      renderChunkSize,
      chunkStride,
      isVisible,
    });

    expect(visible.map((chest) => chest.entityId)).toEqual([1, 2, 3]);
    expect(isVisible).toHaveBeenCalledTimes(3);
  });
});
