import type { ID, TileOpt } from "@bibliothecadao/types";
import { TileOccupier } from "@bibliothecadao/types";
import { getComponentValue, type Component, type Metadata, type Schema } from "@dojoengine/recs";
import { tileOptToTile } from "../utils/tile-opt";

export interface WorldSpatialHex {
  readonly col: number;
  readonly row: number;
}

export interface WorldSpatialBounds {
  readonly minCol: number;
  readonly maxCol: number;
  readonly minRow: number;
  readonly maxRow: number;
}

export interface ChestSpatialRenderable {
  readonly kind: "chest";
  readonly entityId: ID;
  /** Contract-space coordinates, matching TileOpt. */
  readonly hexCoords: WorldSpatialHex;
}

export interface ChestSpatialProjectionChange {
  readonly entityId: ID;
  readonly previous?: ChestSpatialRenderable;
  readonly current?: ChestSpatialRenderable;
}

export interface WorldSpatialProjectionOptions {
  tileOptComponent: Component<Schema, Metadata, unknown>;
  bucketSize?: number;
}

type ChestProjectionListener = (changes: readonly ChestSpatialProjectionChange[]) => void;

const DEFAULT_SPATIAL_BUCKET_SIZE = 32;

const chestHexKey = ({ col, row }: WorldSpatialHex): string => `${col}:${row}`;

const chestBucketKey = ({ col, row }: WorldSpatialHex, bucketSize: number): string =>
  `${Math.floor(col / bucketSize)}:${Math.floor(row / bucketSize)}`;

const isSameChest = (left: ChestSpatialRenderable, right: ChestSpatialRenderable): boolean =>
  left.hexCoords.col === right.hexCoords.col && left.hexCoords.row === right.hexCoords.row;

const resolveChestRenderable = (tileOpt: TileOpt | undefined): ChestSpatialRenderable | undefined => {
  if (!tileOpt) return undefined;

  const tile = tileOptToTile(tileOpt);
  if (tile.alt || tile.occupier_type !== TileOccupier.Chest) return undefined;

  return Object.freeze({
    kind: "chest" as const,
    entityId: tile.occupier_id,
    hexCoords: Object.freeze({ col: tile.col, row: tile.row }),
  });
};

const hasChestProjectionChange = (value: readonly unknown[]): boolean => {
  const [current, previous] = value as [TileOpt | undefined, TileOpt | undefined];
  return resolveChestRenderable(current) !== undefined || resolveChestRenderable(previous) !== undefined;
};

/**
 * Rebuildable spatial read model derived exclusively from authoritative RECS facts.
 *
 * The projection stores renderable identity and location only. Gameplay panels
 * continue to read RECS directly; renderers use this index to select visible
 * entities without introducing another source of gameplay truth.
 */
export class WorldSpatialProjection {
  private readonly tileOptComponent: Component<Schema, Metadata, unknown>;
  private readonly bucketSize: number;
  private chestsById = new Map<ID, ChestSpatialRenderable>();
  private chestIdsByHex = new Map<string, Set<ID>>();
  private chestIdsByBucket = new Map<string, Set<ID>>();
  private listeners = new Set<ChestProjectionListener>();
  private unsubscribeTileOpt: (() => void) | null = null;

  constructor({ tileOptComponent, bucketSize = DEFAULT_SPATIAL_BUCKET_SIZE }: WorldSpatialProjectionOptions) {
    if (!Number.isFinite(bucketSize) || bucketSize <= 0) {
      throw new Error(`WorldSpatialProjection requires a positive bucket size; received ${bucketSize}`);
    }

    this.tileOptComponent = tileOptComponent;
    this.bucketSize = Math.floor(bucketSize);
  }

  public start(): void {
    if (this.unsubscribeTileOpt) return;

    const subscription = this.tileOptComponent.update$.subscribe(({ value }) => {
      if (!hasChestProjectionChange(value)) return;
      this.rebuild();
    });
    this.unsubscribeTileOpt = () => subscription.unsubscribe();
    try {
      this.rebuild();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  public rebuild(): void {
    const nextChests = new Map<ID, ChestSpatialRenderable>();
    for (const entity of this.tileOptComponent.entities()) {
      const tileOpt = getComponentValue(this.tileOptComponent, entity) as TileOpt | undefined;
      const chest = resolveChestRenderable(tileOpt);
      if (chest) nextChests.set(chest.entityId, chest);
    }

    this.replaceChestState(nextChests);
  }

  public getChest(entityId: ID): ChestSpatialRenderable | undefined {
    return this.chestsById.get(entityId);
  }

  public getChests(): readonly ChestSpatialRenderable[] {
    return [...this.chestsById.values()];
  }

  public getChestsAtHex(hexCoords: WorldSpatialHex): readonly ChestSpatialRenderable[] {
    const entityIds = this.chestIdsByHex.get(chestHexKey(hexCoords));
    if (!entityIds) return [];
    return [...entityIds].flatMap((entityId) => {
      const chest = this.chestsById.get(entityId);
      return chest ? [chest] : [];
    });
  }

  public getChestsInBounds(bounds: WorldSpatialBounds): readonly ChestSpatialRenderable[] {
    const startBucketCol = Math.floor(bounds.minCol / this.bucketSize);
    const endBucketCol = Math.floor(bounds.maxCol / this.bucketSize);
    const startBucketRow = Math.floor(bounds.minRow / this.bucketSize);
    const endBucketRow = Math.floor(bounds.maxRow / this.bucketSize);
    const candidates = new Set<ID>();

    for (let bucketCol = startBucketCol; bucketCol <= endBucketCol; bucketCol += 1) {
      for (let bucketRow = startBucketRow; bucketRow <= endBucketRow; bucketRow += 1) {
        this.chestIdsByBucket.get(`${bucketCol}:${bucketRow}`)?.forEach((entityId) => candidates.add(entityId));
      }
    }

    return [...candidates].flatMap((entityId) => {
      const chest = this.chestsById.get(entityId);
      if (!chest || !this.isChestInsideBounds(chest, bounds)) return [];
      return [chest];
    });
  }

  public subscribe(listener: ChestProjectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public dispose(): void {
    this.unsubscribeTileOpt?.();
    this.unsubscribeTileOpt = null;
    this.listeners.clear();
    this.chestsById.clear();
    this.chestIdsByHex.clear();
    this.chestIdsByBucket.clear();
  }

  private replaceChestState(nextChests: Map<ID, ChestSpatialRenderable>): void {
    const changes = this.resolveChestChanges(nextChests);
    this.chestsById = nextChests;
    this.chestIdsByHex = this.buildChestIndex(nextChests, (chest) => chestHexKey(chest.hexCoords));
    this.chestIdsByBucket = this.buildChestIndex(nextChests, (chest) =>
      chestBucketKey(chest.hexCoords, this.bucketSize),
    );
    if (changes.length > 0) this.listeners.forEach((listener) => listener(changes));
  }

  private resolveChestChanges(nextChests: Map<ID, ChestSpatialRenderable>): ChestSpatialProjectionChange[] {
    const changes: ChestSpatialProjectionChange[] = [];

    this.chestsById.forEach((previous, entityId) => {
      const current = nextChests.get(entityId);
      if (!current) changes.push({ entityId, previous });
      else if (!isSameChest(previous, current)) changes.push({ entityId, previous, current });
    });
    nextChests.forEach((current, entityId) => {
      if (!this.chestsById.has(entityId)) changes.push({ entityId, current });
    });

    return changes;
  }

  private buildChestIndex(
    chests: Map<ID, ChestSpatialRenderable>,
    resolveKey: (chest: ChestSpatialRenderable) => string,
  ): Map<string, Set<ID>> {
    const index = new Map<string, Set<ID>>();
    chests.forEach((chest) => {
      const key = resolveKey(chest);
      const entityIds = index.get(key) ?? new Set<ID>();
      entityIds.add(chest.entityId);
      index.set(key, entityIds);
    });
    return index;
  }

  private isChestInsideBounds(chest: ChestSpatialRenderable, bounds: WorldSpatialBounds): boolean {
    return (
      chest.hexCoords.col >= bounds.minCol &&
      chest.hexCoords.col <= bounds.maxCol &&
      chest.hexCoords.row >= bounds.minRow &&
      chest.hexCoords.row <= bounds.maxRow
    );
  }
}
