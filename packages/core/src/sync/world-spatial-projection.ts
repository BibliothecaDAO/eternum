import type { ID, TileOpt } from "@bibliothecadao/types";
import { TileOccupier } from "@bibliothecadao/types";
import { getComponentValue, type Component, type Metadata, type Schema } from "@dojoengine/recs";
import { isTileOccupierStructure } from "../utils/map/hex";
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

interface EntityStructureSpatialRenderable {
  readonly kind: "structure";
  readonly spatialId: `entity:${ID}`;
  readonly entityId: ID;
  readonly reserved: false;
  /** Contract-space coordinates, matching TileOpt. */
  readonly hexCoords: WorldSpatialHex;
  readonly occupierType: number;
}

interface ReservedHyperstructureSpatialRenderable {
  readonly kind: "structure";
  readonly spatialId: `reserved:${number}:${number}`;
  /** Reserved construction sites have no Structure entity until construction starts. */
  readonly entityId: null;
  readonly reserved: true;
  /** Contract-space coordinates, matching TileOpt. */
  readonly hexCoords: WorldSpatialHex;
  readonly occupierType: TileOccupier.ReservedHyperstructure;
}

export type StructureSpatialRenderable = EntityStructureSpatialRenderable | ReservedHyperstructureSpatialRenderable;

export interface ChestSpatialProjectionChange {
  readonly kind: "chest";
  readonly entityId: ID;
  readonly previous?: ChestSpatialRenderable;
  readonly current?: ChestSpatialRenderable;
}

export interface StructureSpatialProjectionChange {
  readonly kind: "structure";
  readonly spatialId: StructureSpatialRenderable["spatialId"];
  readonly previous?: StructureSpatialRenderable;
  readonly current?: StructureSpatialRenderable;
}

export type WorldSpatialProjectionChange = ChestSpatialProjectionChange | StructureSpatialProjectionChange;

export interface WorldSpatialProjectionOptions {
  tileOptComponent: Component<Schema, Metadata, unknown>;
  bucketSize?: number;
}

type ChestProjectionListener = (changes: readonly ChestSpatialProjectionChange[]) => void;
type StructureProjectionListener = (changes: readonly StructureSpatialProjectionChange[]) => void;
type WorldSpatialProjectionListener = (changes: readonly WorldSpatialProjectionChange[]) => void;

interface SpatialRenderable {
  readonly hexCoords: WorldSpatialHex;
}

interface SpatialIndexChange<TKey, TRenderable> {
  readonly key: TKey;
  readonly previous?: TRenderable;
  readonly current?: TRenderable;
}

const DEFAULT_SPATIAL_BUCKET_SIZE = 32;

const spatialHexKey = ({ col, row }: WorldSpatialHex): string => `${col}:${row}`;

const spatialBucketKey = ({ col, row }: WorldSpatialHex, bucketSize: number): string =>
  `${Math.floor(col / bucketSize)}:${Math.floor(row / bucketSize)}`;

const isSameChest = (left: ChestSpatialRenderable, right: ChestSpatialRenderable): boolean =>
  left.hexCoords.col === right.hexCoords.col && left.hexCoords.row === right.hexCoords.row;

const isSameStructure = (left: StructureSpatialRenderable, right: StructureSpatialRenderable): boolean =>
  left.entityId === right.entityId &&
  left.occupierType === right.occupierType &&
  left.hexCoords.col === right.hexCoords.col &&
  left.hexCoords.row === right.hexCoords.row;

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

const resolveStructureRenderable = (tileOpt: TileOpt | undefined): StructureSpatialRenderable | undefined => {
  if (!tileOpt) return undefined;

  const tile = tileOptToTile(tileOpt);
  if (tile.alt || !isTileOccupierStructure(tile.occupier_type)) return undefined;

  const hexCoords = Object.freeze({ col: tile.col, row: tile.row });
  if (tile.occupier_type === TileOccupier.ReservedHyperstructure) {
    return Object.freeze({
      kind: "structure" as const,
      spatialId: `reserved:${tile.col}:${tile.row}` as const,
      entityId: null,
      reserved: true as const,
      hexCoords,
      occupierType: TileOccupier.ReservedHyperstructure,
    });
  }

  return Object.freeze({
    kind: "structure" as const,
    spatialId: `entity:${tile.occupier_id}` as const,
    entityId: tile.occupier_id,
    reserved: false as const,
    hexCoords,
    occupierType: tile.occupier_type,
  });
};

class SpatialIndex<TKey, TRenderable extends SpatialRenderable> {
  private byKey = new Map<TKey, TRenderable>();
  private keysByHex = new Map<string, Set<TKey>>();
  private keysByBucket = new Map<string, Set<TKey>>();

  constructor(
    private readonly bucketSize: number,
    private readonly isSame: (left: TRenderable, right: TRenderable) => boolean,
  ) {}

  public replace(nextByKey: Map<TKey, TRenderable>): SpatialIndexChange<TKey, TRenderable>[] {
    const changes = this.resolveChanges(nextByKey);
    this.byKey = nextByKey;
    this.keysByHex = this.buildIndex((renderable) => spatialHexKey(renderable.hexCoords));
    this.keysByBucket = this.buildIndex((renderable) => spatialBucketKey(renderable.hexCoords, this.bucketSize));
    return changes;
  }

  public update(key: TKey, current: TRenderable | undefined): SpatialIndexChange<TKey, TRenderable> | undefined {
    const previous = this.byKey.get(key);
    if (!previous && !current) return undefined;
    if (previous && current && this.isSame(previous, current)) return undefined;

    if (previous) this.removeFromSpatialIndexes(key, previous);
    if (current) {
      this.byKey.set(key, current);
      this.addToSpatialIndexes(key, current);
    } else {
      this.byKey.delete(key);
    }

    return { key, previous, current };
  }

  public get(key: TKey): TRenderable | undefined {
    return this.byKey.get(key);
  }

  public getAll(): readonly TRenderable[] {
    return [...this.byKey.values()];
  }

  public getAtHex(hexCoords: WorldSpatialHex): readonly TRenderable[] {
    return this.resolveKeys(this.keysByHex.get(spatialHexKey(hexCoords)));
  }

  public getInBounds(bounds: WorldSpatialBounds): readonly TRenderable[] {
    const startBucketCol = Math.floor(bounds.minCol / this.bucketSize);
    const endBucketCol = Math.floor(bounds.maxCol / this.bucketSize);
    const startBucketRow = Math.floor(bounds.minRow / this.bucketSize);
    const endBucketRow = Math.floor(bounds.maxRow / this.bucketSize);
    const candidates = new Set<TKey>();

    for (let bucketCol = startBucketCol; bucketCol <= endBucketCol; bucketCol += 1) {
      for (let bucketRow = startBucketRow; bucketRow <= endBucketRow; bucketRow += 1) {
        this.keysByBucket.get(`${bucketCol}:${bucketRow}`)?.forEach((key) => candidates.add(key));
      }
    }

    return this.resolveKeys(candidates).filter((renderable) => isInsideBounds(renderable.hexCoords, bounds));
  }

  public clear(): void {
    this.byKey.clear();
    this.keysByHex.clear();
    this.keysByBucket.clear();
  }

  private resolveChanges(nextByKey: Map<TKey, TRenderable>): SpatialIndexChange<TKey, TRenderable>[] {
    const changes: SpatialIndexChange<TKey, TRenderable>[] = [];

    this.byKey.forEach((previous, key) => {
      const current = nextByKey.get(key);
      if (!current) changes.push({ key, previous });
      else if (!this.isSame(previous, current)) changes.push({ key, previous, current });
    });
    nextByKey.forEach((current, key) => {
      if (!this.byKey.has(key)) changes.push({ key, current });
    });

    return changes;
  }

  private buildIndex(resolveKey: (renderable: TRenderable) => string): Map<string, Set<TKey>> {
    const index = new Map<string, Set<TKey>>();
    this.byKey.forEach((renderable, key) => {
      const spatialKey = resolveKey(renderable);
      const keys = index.get(spatialKey) ?? new Set<TKey>();
      keys.add(key);
      index.set(spatialKey, keys);
    });
    return index;
  }

  private addToSpatialIndexes(key: TKey, renderable: TRenderable): void {
    this.addToIndex(this.keysByHex, spatialHexKey(renderable.hexCoords), key);
    this.addToIndex(this.keysByBucket, spatialBucketKey(renderable.hexCoords, this.bucketSize), key);
  }

  private addToIndex(index: Map<string, Set<TKey>>, spatialKey: string, key: TKey): void {
    const keys = index.get(spatialKey) ?? new Set<TKey>();
    keys.add(key);
    index.set(spatialKey, keys);
  }

  private removeFromSpatialIndexes(key: TKey, renderable: TRenderable): void {
    this.removeFromIndex(this.keysByHex, spatialHexKey(renderable.hexCoords), key);
    this.removeFromIndex(this.keysByBucket, spatialBucketKey(renderable.hexCoords, this.bucketSize), key);
  }

  private removeFromIndex(index: Map<string, Set<TKey>>, spatialKey: string, key: TKey): void {
    const keys = index.get(spatialKey);
    keys?.delete(key);
    if (keys?.size === 0) index.delete(spatialKey);
  }

  private resolveKeys(keys: Iterable<TKey> | undefined): TRenderable[] {
    if (!keys) return [];
    return [...keys].flatMap((key) => {
      const renderable = this.byKey.get(key);
      return renderable ? [renderable] : [];
    });
  }
}

const isInsideBounds = (hexCoords: WorldSpatialHex, bounds: WorldSpatialBounds): boolean =>
  hexCoords.col >= bounds.minCol &&
  hexCoords.col <= bounds.maxCol &&
  hexCoords.row >= bounds.minRow &&
  hexCoords.row <= bounds.maxRow;

/**
 * Rebuildable spatial read model derived exclusively from authoritative RECS facts.
 *
 * The projection stores renderable identity and location only. Gameplay panels
 * continue to read RECS directly; renderers use this index to select visible
 * entities without introducing another source of gameplay truth.
 */
export class WorldSpatialProjection {
  private readonly tileOptComponent: Component<Schema, Metadata, unknown>;
  private readonly chestIndex: SpatialIndex<ID, ChestSpatialRenderable>;
  private readonly structureIndex: SpatialIndex<StructureSpatialRenderable["spatialId"], StructureSpatialRenderable>;
  private readonly chestsByTileEntity = new Map<unknown, ChestSpatialRenderable>();
  private readonly structuresByTileEntity = new Map<unknown, StructureSpatialRenderable>();
  private readonly listeners = new Set<WorldSpatialProjectionListener>();
  private readonly chestListeners = new Set<ChestProjectionListener>();
  private readonly structureListeners = new Set<StructureProjectionListener>();
  private unsubscribeTileOpt: (() => void) | null = null;

  constructor({ tileOptComponent, bucketSize = DEFAULT_SPATIAL_BUCKET_SIZE }: WorldSpatialProjectionOptions) {
    if (!Number.isFinite(bucketSize) || bucketSize <= 0) {
      throw new Error(`WorldSpatialProjection requires a positive bucket size; received ${bucketSize}`);
    }

    this.tileOptComponent = tileOptComponent;
    const normalizedBucketSize = Math.floor(bucketSize);
    this.chestIndex = new SpatialIndex(normalizedBucketSize, isSameChest);
    this.structureIndex = new SpatialIndex(normalizedBucketSize, isSameStructure);
  }

  public start(): void {
    if (this.unsubscribeTileOpt) return;

    const subscription = this.tileOptComponent.update$.subscribe(({ entity, value }) => {
      this.applyTileOptUpdate(entity, value as [TileOpt | undefined, TileOpt | undefined]);
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
    const nextStructures = new Map<StructureSpatialRenderable["spatialId"], StructureSpatialRenderable>();
    this.chestsByTileEntity.clear();
    this.structuresByTileEntity.clear();

    for (const entity of this.tileOptComponent.entities()) {
      const tileOpt = getComponentValue(this.tileOptComponent, entity) as TileOpt | undefined;
      const chest = resolveChestRenderable(tileOpt);
      if (chest) {
        this.chestsByTileEntity.set(entity, chest);
        nextChests.set(chest.entityId, chest);
      }

      const structure = resolveStructureRenderable(tileOpt);
      if (structure) {
        this.structuresByTileEntity.set(entity, structure);
        nextStructures.set(structure.spatialId, structure);
      }
    }

    const chestChanges = this.chestIndex.replace(nextChests).map(
      ({ key: entityId, previous, current }): ChestSpatialProjectionChange => ({
        kind: "chest",
        entityId,
        previous,
        current,
      }),
    );
    const structureChanges = this.structureIndex.replace(nextStructures).map(
      ({ key: spatialId, previous, current }): StructureSpatialProjectionChange => ({
        kind: "structure",
        spatialId,
        previous,
        current,
      }),
    );

    this.publishChanges(chestChanges, structureChanges);
  }

  private applyTileOptUpdate(tileEntity: unknown, [currentTileOpt]: [TileOpt | undefined, TileOpt | undefined]): void {
    const previousChest = this.chestsByTileEntity.get(tileEntity);
    const currentChest = resolveChestRenderable(currentTileOpt);
    this.replaceTileSource(this.chestsByTileEntity, tileEntity, currentChest);
    const chestChanges = this.reconcileSourceKeys(
      this.chestIndex,
      this.chestsByTileEntity,
      previousChest?.entityId,
      currentChest?.entityId,
      currentChest,
      (chest) => chest.entityId,
    ).map(
      ({ key: entityId, previous, current }): ChestSpatialProjectionChange => ({
        kind: "chest",
        entityId,
        previous,
        current,
      }),
    );

    const previousStructure = this.structuresByTileEntity.get(tileEntity);
    const currentStructure = resolveStructureRenderable(currentTileOpt);
    this.replaceTileSource(this.structuresByTileEntity, tileEntity, currentStructure);
    const structureChanges = this.reconcileSourceKeys(
      this.structureIndex,
      this.structuresByTileEntity,
      previousStructure?.spatialId,
      currentStructure?.spatialId,
      currentStructure,
      (structure) => structure.spatialId,
    ).map(
      ({ key: spatialId, previous, current }): StructureSpatialProjectionChange => ({
        kind: "structure",
        spatialId,
        previous,
        current,
      }),
    );

    this.publishChanges(chestChanges, structureChanges);
  }

  private replaceTileSource<TRenderable>(
    sources: Map<unknown, TRenderable>,
    tileEntity: unknown,
    current: TRenderable | undefined,
  ): void {
    if (current) sources.set(tileEntity, current);
    else sources.delete(tileEntity);
  }

  private reconcileSourceKeys<TKey, TRenderable extends SpatialRenderable>(
    index: SpatialIndex<TKey, TRenderable>,
    sources: ReadonlyMap<unknown, TRenderable>,
    previousKey: TKey | undefined,
    currentKey: TKey | undefined,
    preferredCurrent: TRenderable | undefined,
    resolveKey: (renderable: TRenderable) => TKey,
  ): SpatialIndexChange<TKey, TRenderable>[] {
    const keys = new Set<TKey>();
    if (previousKey !== undefined) keys.add(previousKey);
    if (currentKey !== undefined) keys.add(currentKey);

    return [...keys].flatMap((key) => {
      const current =
        currentKey === key && preferredCurrent
          ? preferredCurrent
          : [...sources.values()].find((candidate) => resolveKey(candidate) === key);
      const change = index.update(key, current);
      return change ? [change] : [];
    });
  }

  private publishChanges(
    chestChanges: readonly ChestSpatialProjectionChange[],
    structureChanges: readonly StructureSpatialProjectionChange[],
  ): void {
    if (chestChanges.length > 0) this.chestListeners.forEach((listener) => listener(chestChanges));
    if (structureChanges.length > 0) this.structureListeners.forEach((listener) => listener(structureChanges));
    const changes: WorldSpatialProjectionChange[] = [...chestChanges, ...structureChanges];
    if (changes.length > 0) this.listeners.forEach((listener) => listener(changes));
  }

  public getChest(entityId: ID): ChestSpatialRenderable | undefined {
    return this.chestIndex.get(entityId);
  }

  public getChests(): readonly ChestSpatialRenderable[] {
    return this.chestIndex.getAll();
  }

  public getChestsAtHex(hexCoords: WorldSpatialHex): readonly ChestSpatialRenderable[] {
    return this.chestIndex.getAtHex(hexCoords);
  }

  public getChestsInBounds(bounds: WorldSpatialBounds): readonly ChestSpatialRenderable[] {
    return this.chestIndex.getInBounds(bounds);
  }

  public getStructure(entityId: ID): EntityStructureSpatialRenderable | undefined {
    const structure = this.structureIndex.get(`entity:${entityId}`);
    return structure && !structure.reserved ? structure : undefined;
  }

  public getStructures(): readonly StructureSpatialRenderable[] {
    return this.structureIndex.getAll();
  }

  public getStructuresAtHex(hexCoords: WorldSpatialHex): readonly StructureSpatialRenderable[] {
    return this.structureIndex.getAtHex(hexCoords);
  }

  public getStructuresInBounds(bounds: WorldSpatialBounds): readonly StructureSpatialRenderable[] {
    return this.structureIndex.getInBounds(bounds);
  }

  public subscribe(listener: WorldSpatialProjectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeChests(listener: ChestProjectionListener): () => void {
    this.chestListeners.add(listener);
    return () => this.chestListeners.delete(listener);
  }

  public subscribeStructures(listener: StructureProjectionListener): () => void {
    this.structureListeners.add(listener);
    return () => this.structureListeners.delete(listener);
  }

  public dispose(): void {
    this.unsubscribeTileOpt?.();
    this.unsubscribeTileOpt = null;
    this.listeners.clear();
    this.chestListeners.clear();
    this.structureListeners.clear();
    this.chestIndex.clear();
    this.structureIndex.clear();
    this.chestsByTileEntity.clear();
    this.structuresByTileEntity.clear();
  }
}
