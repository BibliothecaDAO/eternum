import { ID } from "@bibliothecadao/types";
import { RenderChunkSize } from "../types/common";
import { getRenderBounds } from "../utils/chunk-geometry";

export interface IndexedChestHexCoords {
  getNormalized(): { x: number; y: number };
}

export interface IndexedChestLike {
  entityId: ID;
  hexCoords: IndexedChestHexCoords;
}

function getChestBucketKey(hexCoords: IndexedChestHexCoords, chunkStride: number): string {
  const { x, y } = hexCoords.getNormalized();
  return `${Math.floor(x / chunkStride)},${Math.floor(y / chunkStride)}`;
}

export class ChestSpatialIndex<T extends ID = ID> {
  private readonly buckets: Map<string, Set<T>> = new Map();

  constructor(private readonly chunkStride: number) {}

  public clear(): void {
    this.buckets.clear();
  }

  public upsert(entityId: T, previousHex: IndexedChestHexCoords | undefined, nextHex: IndexedChestHexCoords): void {
    const nextKey = getChestBucketKey(nextHex, this.chunkStride);
    const previousKey = previousHex ? getChestBucketKey(previousHex, this.chunkStride) : undefined;

    if (previousKey && previousKey !== nextKey) {
      this.remove(entityId, previousHex);
    }

    let bucket = this.buckets.get(nextKey);
    if (!bucket) {
      bucket = new Set<T>();
      this.buckets.set(nextKey, bucket);
    }

    bucket.add(entityId);
  }

  public remove(entityId: T, hexCoords: IndexedChestHexCoords | undefined): void {
    if (!hexCoords) {
      return;
    }

    const bucket = this.buckets.get(getChestBucketKey(hexCoords, this.chunkStride));
    if (!bucket) {
      return;
    }

    bucket.delete(entityId);
    if (bucket.size === 0) {
      this.buckets.delete(getChestBucketKey(hexCoords, this.chunkStride));
    }
  }

  public getCandidateIdsForChunk(
    startRow: number,
    startCol: number,
    renderChunkSize: RenderChunkSize,
  ): T[] {
    const bounds = getRenderBounds(startRow, startCol, renderChunkSize, this.chunkStride);
    const startBucketX = Math.floor(bounds.minCol / this.chunkStride);
    const endBucketX = Math.floor(bounds.maxCol / this.chunkStride);
    const startBucketY = Math.floor(bounds.minRow / this.chunkStride);
    const endBucketY = Math.floor(bounds.maxRow / this.chunkStride);
    const ids: T[] = [];

    for (let bucketX = startBucketX; bucketX <= endBucketX; bucketX++) {
      for (let bucketY = startBucketY; bucketY <= endBucketY; bucketY++) {
        const bucket = this.buckets.get(`${bucketX},${bucketY}`);
        if (!bucket) {
          continue;
        }

        ids.push(...bucket);
      }
    }

    return ids;
  }
}

interface CollectVisibleChestsForChunkParams<T extends ID, TChest extends IndexedChestLike> {
  chests: Map<T, TChest>;
  index: ChestSpatialIndex<T>;
  startRow: number;
  startCol: number;
  renderChunkSize: RenderChunkSize;
  chunkStride: number;
  isVisible?: (chest: TChest, startRow: number, startCol: number) => boolean;
}

export function collectVisibleChestsForChunk<T extends ID, TChest extends IndexedChestLike>({
  chests,
  index,
  startRow,
  startCol,
  renderChunkSize,
  chunkStride,
  isVisible,
}: CollectVisibleChestsForChunkParams<T, TChest>): TChest[] {
  const bounds = getRenderBounds(startRow, startCol, renderChunkSize, chunkStride);
  const defaultIsVisible = (chest: TChest) => {
    const { x, y } = chest.hexCoords.getNormalized();
    return x >= bounds.minCol && x <= bounds.maxCol && y >= bounds.minRow && y <= bounds.maxRow;
  };

  return index
    .getCandidateIdsForChunk(startRow, startCol, renderChunkSize)
    .map((entityId) => chests.get(entityId))
    .filter((chest): chest is TChest => Boolean(chest))
    .filter((chest) => (isVisible ?? defaultIsVisible)(chest, startRow, startCol));
}
