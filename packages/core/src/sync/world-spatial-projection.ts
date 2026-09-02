import type { ID, TileOpt, TroopTier, TroopType } from "@bibliothecadao/types";
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

export interface TileSpatialRenderable {
  readonly kind: "tile";
  readonly spatialId: `tile:${number}:${number}`;
  /** Contract-space coordinates, matching TileOpt. */
  readonly hexCoords: WorldSpatialHex;
  readonly biome: number;
  readonly occupierId: ID;
  readonly occupierType: number;
  readonly occupierIsStructure: boolean;
  readonly rewardExtracted: boolean;
}

export interface ChestSpatialRenderable {
  readonly kind: "chest";
  readonly entityId: ID;
  /** Contract-space coordinates, matching TileOpt. */
  readonly hexCoords: WorldSpatialHex;
}

export interface ArmySpatialRenderable {
  readonly kind: "army";
  readonly entityId: ID;
  /** Contract-space coordinates, matching ExplorerTroops.coord. */
  readonly hexCoords: WorldSpatialHex;
  readonly troopCategory: TroopType;
  readonly troopTier: TroopTier;
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

export interface ArmySpatialProjectionChange {
  readonly kind: "army";
  readonly entityId: ID;
  readonly previous?: ArmySpatialRenderable;
  readonly current?: ArmySpatialRenderable;
}

export interface TileSpatialProjectionChange {
  readonly kind: "tile";
  readonly spatialId: TileSpatialRenderable["spatialId"];
  readonly previous?: TileSpatialRenderable;
  readonly current?: TileSpatialRenderable;
}

export type WorldSpatialProjectionChange =
  | TileSpatialProjectionChange
  | ChestSpatialProjectionChange
  | StructureSpatialProjectionChange
  | ArmySpatialProjectionChange;

export interface WorldSpatialProjectionOptions {
  tileOptComponent: Component<Schema, Metadata, unknown>;
  explorerTroopsComponent: Component<Schema, Metadata, unknown>;
  bucketSize?: number;
}

type ChestProjectionListener = (changes: readonly ChestSpatialProjectionChange[]) => void;
type StructureProjectionListener = (changes: readonly StructureSpatialProjectionChange[]) => void;
type ArmyProjectionListener = (changes: readonly ArmySpatialProjectionChange[]) => void;
type TileProjectionListener = (changes: readonly TileSpatialProjectionChange[]) => void;
type WorldSpatialProjectionListener = (changes: readonly WorldSpatialProjectionChange[]) => void;

interface ExplorerTroopsSpatialSource {
  readonly explorer_id: ID;
  readonly troops: {
    readonly category: string;
    readonly tier: string;
    readonly count: bigint;
  };
  readonly coord: {
    readonly alt: boolean;
    readonly x: number;
    readonly y: number;
  };
}

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

const isSameArmy = (left: ArmySpatialRenderable, right: ArmySpatialRenderable): boolean =>
  left.troopCategory === right.troopCategory &&
  left.troopTier === right.troopTier &&
  left.hexCoords.col === right.hexCoords.col &&
  left.hexCoords.row === right.hexCoords.row;

const isSameTile = (left: TileSpatialRenderable, right: TileSpatialRenderable): boolean =>
  left.biome === right.biome &&
  left.occupierId === right.occupierId &&
  left.occupierType === right.occupierType &&
  left.occupierIsStructure === right.occupierIsStructure &&
  left.rewardExtracted === right.rewardExtracted;

const resolveTileRenderable = (tileOpt: TileOpt | undefined): TileSpatialRenderable | undefined => {
  if (!tileOpt) return undefined;

  const tile = tileOptToTile(tileOpt);
  if (tile.alt) return undefined;

  return Object.freeze({
    kind: "tile" as const,
    spatialId: `tile:${tile.col}:${tile.row}` as const,
    hexCoords: Object.freeze({ col: tile.col, row: tile.row }),
    biome: tile.biome,
    occupierId: tile.occupier_id,
    occupierType: tile.occupier_type,
    occupierIsStructure: tile.occupier_is_structure,
    rewardExtracted: tile.reward_extracted,
  });
};

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

const resolveArmyRenderable = (
  explorerTroops: ExplorerTroopsSpatialSource | undefined,
): ArmySpatialRenderable | undefined => {
  if (!explorerTroops || explorerTroops.coord.alt || explorerTroops.troops.count <= 0n) return undefined;

  const col = Number(explorerTroops.coord.x);
  const row = Number(explorerTroops.coord.y);
  if (!Number.isFinite(col) || !Number.isFinite(row)) return undefined;

  return Object.freeze({
    kind: "army" as const,
    entityId: explorerTroops.explorer_id,
    hexCoords: Object.freeze({ col, row }),
    troopCategory: explorerTroops.troops.category as TroopType,
    troopTier: explorerTroops.troops.tier as TroopTier,
  });
};

class SpatialIndex<TKey, TRenderable extends SpatialRenderable> {
  private byKey = new Map<TKey, TRenderable>();
  private keysByHex = new Map<string, Set<TKey>>();
  private keysByBucket = new Map<string, Set<TKey>>();
  /**
   * Net change per key since the last drain. The index itself moves on every row so reads
   * between rows always reflect the latest RECS state; only the notification waits.
   */
  private pendingChanges = new Map<TKey, SpatialIndexChange<TKey, TRenderable>>();

  constructor(
    private readonly bucketSize: number,
    private readonly isSame: (left: TRenderable, right: TRenderable) => boolean,
  ) {}

  public replace(nextByKey: Map<TKey, TRenderable>): void {
    this.resolveChanges(nextByKey).forEach((change) => this.queueChange(change));
    this.byKey = nextByKey;
    this.keysByHex = this.buildIndex((renderable) => spatialHexKey(renderable.hexCoords));
    this.keysByBucket = this.buildIndex((renderable) => spatialBucketKey(renderable.hexCoords, this.bucketSize));
  }

  public update(key: TKey, current: TRenderable | undefined): void {
    const previous = this.byKey.get(key);
    if (!previous && !current) return;
    if (previous && current && this.isSame(previous, current)) return;

    if (previous) this.removeFromSpatialIndexes(key, previous);
    if (current) {
      this.byKey.set(key, current);
      this.addToSpatialIndexes(key, current);
    } else {
      this.byKey.delete(key);
    }

    this.queueChange({ key, previous, current });
  }

  public drainChanges(): SpatialIndexChange<TKey, TRenderable>[] {
    const changes = [...this.pendingChanges.values()];
    this.pendingChanges.clear();
    return changes;
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
    this.pendingChanges.clear();
  }

  /**
   * Merge rule: a listener needs the first previous and the last current of a key, nothing in
   * between. A key that ends where it started (created then removed, moved and moved back) is
   * dropped instead of published as a no-op.
   */
  private queueChange(change: SpatialIndexChange<TKey, TRenderable>): void {
    const pending = this.pendingChanges.get(change.key);
    const previous = pending ? pending.previous : change.previous;
    const current = change.current;
    const isUnchanged =
      previous === undefined ? current === undefined : current !== undefined && this.isSame(previous, current);

    if (isUnchanged) this.pendingChanges.delete(change.key);
    else this.pendingChanges.set(change.key, { key: change.key, previous, current });
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

const toTileChange = ({
  key: spatialId,
  previous,
  current,
}: SpatialIndexChange<TileSpatialRenderable["spatialId"], TileSpatialRenderable>): TileSpatialProjectionChange => ({
  kind: "tile",
  spatialId,
  previous,
  current,
});

const toChestChange = ({
  key: entityId,
  previous,
  current,
}: SpatialIndexChange<ID, ChestSpatialRenderable>): ChestSpatialProjectionChange => ({
  kind: "chest",
  entityId,
  previous,
  current,
});

const toStructureChange = ({
  key: spatialId,
  previous,
  current,
}: SpatialIndexChange<
  StructureSpatialRenderable["spatialId"],
  StructureSpatialRenderable
>): StructureSpatialProjectionChange => ({
  kind: "structure",
  spatialId,
  previous,
  current,
});

const toArmyChange = ({
  key: entityId,
  previous,
  current,
}: SpatialIndexChange<ID, ArmySpatialRenderable>): ArmySpatialProjectionChange => ({
  kind: "army",
  entityId,
  previous,
  current,
});

/**
 * Rebuildable spatial read model derived exclusively from authoritative RECS facts.
 *
 * The projection stores renderable identity, location, and mesh variant only.
 * Gameplay panels continue to read RECS directly; renderers use this index to
 * select visible entities without introducing another source of gameplay truth.
 *
 * Every RECS row updates the indexes immediately; listeners hear the net result once per
 * `flush()`, which the sync runtime calls after each applied ingest slice.
 */
export class WorldSpatialProjection {
  private readonly tileOptComponent: Component<Schema, Metadata, unknown>;
  private readonly explorerTroopsComponent: Component<Schema, Metadata, unknown>;
  private readonly chestIndex: SpatialIndex<ID, ChestSpatialRenderable>;
  private readonly structureIndex: SpatialIndex<StructureSpatialRenderable["spatialId"], StructureSpatialRenderable>;
  private readonly armyIndex: SpatialIndex<ID, ArmySpatialRenderable>;
  private readonly tileIndex: SpatialIndex<TileSpatialRenderable["spatialId"], TileSpatialRenderable>;
  private readonly tilesByTileEntity = new Map<unknown, TileSpatialRenderable>();
  private readonly chestsByTileEntity = new Map<unknown, ChestSpatialRenderable>();
  private readonly structuresByTileEntity = new Map<unknown, StructureSpatialRenderable>();
  private readonly listeners = new Set<WorldSpatialProjectionListener>();
  private readonly chestListeners = new Set<ChestProjectionListener>();
  private readonly structureListeners = new Set<StructureProjectionListener>();
  private readonly armyListeners = new Set<ArmyProjectionListener>();
  private readonly tileListeners = new Set<TileProjectionListener>();
  private unsubscribeTileOpt: (() => void) | null = null;
  private unsubscribeExplorerTroops: (() => void) | null = null;

  constructor({
    tileOptComponent,
    explorerTroopsComponent,
    bucketSize = DEFAULT_SPATIAL_BUCKET_SIZE,
  }: WorldSpatialProjectionOptions) {
    if (!Number.isFinite(bucketSize) || bucketSize <= 0) {
      throw new Error(`WorldSpatialProjection requires a positive bucket size; received ${bucketSize}`);
    }

    this.tileOptComponent = tileOptComponent;
    this.explorerTroopsComponent = explorerTroopsComponent;
    const normalizedBucketSize = Math.floor(bucketSize);
    this.chestIndex = new SpatialIndex(normalizedBucketSize, isSameChest);
    this.structureIndex = new SpatialIndex(normalizedBucketSize, isSameStructure);
    this.armyIndex = new SpatialIndex(normalizedBucketSize, isSameArmy);
    this.tileIndex = new SpatialIndex(normalizedBucketSize, isSameTile);
  }

  public start(): void {
    if (this.unsubscribeTileOpt || this.unsubscribeExplorerTroops) return;

    const tileOptSubscription = this.tileOptComponent.update$.subscribe(({ entity, value }) => {
      this.applyTileOptUpdate(entity, value as [TileOpt | undefined, TileOpt | undefined]);
    });
    const explorerTroopsSubscription = this.explorerTroopsComponent.update$.subscribe(({ value }) => {
      this.applyExplorerTroopsUpdate(
        value as [ExplorerTroopsSpatialSource | undefined, ExplorerTroopsSpatialSource | undefined],
      );
    });
    this.unsubscribeTileOpt = () => tileOptSubscription.unsubscribe();
    this.unsubscribeExplorerTroops = () => explorerTroopsSubscription.unsubscribe();
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
    const nextArmies = new Map<ID, ArmySpatialRenderable>();
    const nextTiles = new Map<TileSpatialRenderable["spatialId"], TileSpatialRenderable>();
    this.tilesByTileEntity.clear();
    this.chestsByTileEntity.clear();
    this.structuresByTileEntity.clear();

    for (const entity of this.tileOptComponent.entities()) {
      const tileOpt = getComponentValue(this.tileOptComponent, entity) as TileOpt | undefined;
      const tile = resolveTileRenderable(tileOpt);
      if (tile) {
        this.tilesByTileEntity.set(entity, tile);
        nextTiles.set(tile.spatialId, tile);
      }

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

    for (const entity of this.explorerTroopsComponent.entities()) {
      const explorerTroops = getComponentValue(this.explorerTroopsComponent, entity) as
        | ExplorerTroopsSpatialSource
        | undefined;
      const army = resolveArmyRenderable(explorerTroops);
      if (army) nextArmies.set(army.entityId, army);
    }

    this.chestIndex.replace(nextChests);
    this.structureIndex.replace(nextStructures);
    this.armyIndex.replace(nextArmies);
    this.tileIndex.replace(nextTiles);
    // A rebuild is a recovery step, not an ingest slice: listeners hear about it right away.
    this.flush();
  }

  private applyTileOptUpdate(tileEntity: unknown, [currentTileOpt]: [TileOpt | undefined, TileOpt | undefined]): void {
    const previousTile = this.tilesByTileEntity.get(tileEntity);
    const currentTile = resolveTileRenderable(currentTileOpt);
    this.replaceTileSource(this.tilesByTileEntity, tileEntity, currentTile);
    this.reconcileSourceKeys(
      this.tileIndex,
      this.tilesByTileEntity,
      previousTile?.spatialId,
      currentTile?.spatialId,
      currentTile,
      (tile) => tile.spatialId,
    );

    const previousChest = this.chestsByTileEntity.get(tileEntity);
    const currentChest = resolveChestRenderable(currentTileOpt);
    this.replaceTileSource(this.chestsByTileEntity, tileEntity, currentChest);
    this.reconcileSourceKeys(
      this.chestIndex,
      this.chestsByTileEntity,
      previousChest?.entityId,
      currentChest?.entityId,
      currentChest,
      (chest) => chest.entityId,
    );

    const previousStructure = this.structuresByTileEntity.get(tileEntity);
    const currentStructure = resolveStructureRenderable(currentTileOpt);
    this.replaceTileSource(this.structuresByTileEntity, tileEntity, currentStructure);
    this.reconcileSourceKeys(
      this.structureIndex,
      this.structuresByTileEntity,
      previousStructure?.spatialId,
      currentStructure?.spatialId,
      currentStructure,
      (structure) => structure.spatialId,
    );
  }

  private applyExplorerTroopsUpdate([currentExplorerTroops, previousExplorerTroops]: [
    ExplorerTroopsSpatialSource | undefined,
    ExplorerTroopsSpatialSource | undefined,
  ]): void {
    const currentArmy = resolveArmyRenderable(currentExplorerTroops);
    const previousEntityId = previousExplorerTroops?.explorer_id;
    const currentEntityId = currentArmy?.entityId;
    const entityIds = new Set<ID>();
    if (previousEntityId !== undefined && previousEntityId !== null) entityIds.add(previousEntityId);
    if (currentEntityId !== undefined && currentEntityId !== null) entityIds.add(currentEntityId);

    entityIds.forEach((entityId) => {
      this.armyIndex.update(entityId, currentEntityId === entityId ? currentArmy : undefined);
    });
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
  ): void {
    const keys = new Set<TKey>();
    if (previousKey !== undefined) keys.add(previousKey);
    if (currentKey !== undefined) keys.add(currentKey);

    keys.forEach((key) => {
      const current =
        currentKey === key && preferredCurrent
          ? preferredCurrent
          : [...sources.values()].find((candidate) => resolveKey(candidate) === key);
      index.update(key, current);
    });
  }

  private publishChanges(
    tileChanges: readonly TileSpatialProjectionChange[],
    chestChanges: readonly ChestSpatialProjectionChange[],
    structureChanges: readonly StructureSpatialProjectionChange[],
    armyChanges: readonly ArmySpatialProjectionChange[],
  ): void {
    if (tileChanges.length > 0) this.tileListeners.forEach((listener) => listener(tileChanges));
    if (chestChanges.length > 0) this.chestListeners.forEach((listener) => listener(chestChanges));
    if (structureChanges.length > 0) this.structureListeners.forEach((listener) => listener(structureChanges));
    if (armyChanges.length > 0) this.armyListeners.forEach((listener) => listener(armyChanges));
    const changes: WorldSpatialProjectionChange[] = [
      ...tileChanges,
      ...chestChanges,
      ...structureChanges,
      ...armyChanges,
    ];
    if (changes.length > 0) this.listeners.forEach((listener) => listener(changes));
  }

  public getChest(entityId: ID): ChestSpatialRenderable | undefined {
    return this.chestIndex.get(entityId);
  }

  public getTiles(): readonly TileSpatialRenderable[] {
    return this.tileIndex.getAll();
  }

  public getTileAtHex(hexCoords: WorldSpatialHex): TileSpatialRenderable | undefined {
    return this.tileIndex.getAtHex(hexCoords)[0];
  }

  public getTilesInBounds(bounds: WorldSpatialBounds): readonly TileSpatialRenderable[] {
    return this.tileIndex.getInBounds(bounds);
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

  public getArmy(entityId: ID): ArmySpatialRenderable | undefined {
    return this.armyIndex.get(entityId);
  }

  public getArmies(): readonly ArmySpatialRenderable[] {
    return this.armyIndex.getAll();
  }

  public getArmiesAtHex(hexCoords: WorldSpatialHex): readonly ArmySpatialRenderable[] {
    return this.armyIndex.getAtHex(hexCoords);
  }

  public getArmiesInBounds(bounds: WorldSpatialBounds): readonly ArmySpatialRenderable[] {
    return this.armyIndex.getInBounds(bounds);
  }

  /**
   * Publishes the net changes accumulated since the last flush. The runtime owns the cadence and
   * calls this once per applied ingest slice, so a listener runs once per slice, not once per row.
   */
  public flush(): void {
    this.publishChanges(
      this.tileIndex.drainChanges().map(toTileChange),
      this.chestIndex.drainChanges().map(toChestChange),
      this.structureIndex.drainChanges().map(toStructureChange),
      this.armyIndex.drainChanges().map(toArmyChange),
    );
  }

  public subscribe(listener: WorldSpatialProjectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeTiles(listener: TileProjectionListener): () => void {
    this.tileListeners.add(listener);
    return () => this.tileListeners.delete(listener);
  }

  public subscribeChests(listener: ChestProjectionListener): () => void {
    this.chestListeners.add(listener);
    return () => this.chestListeners.delete(listener);
  }

  public subscribeStructures(listener: StructureProjectionListener): () => void {
    this.structureListeners.add(listener);
    return () => this.structureListeners.delete(listener);
  }

  public subscribeArmies(listener: ArmyProjectionListener): () => void {
    this.armyListeners.add(listener);
    return () => this.armyListeners.delete(listener);
  }

  public dispose(): void {
    this.unsubscribeTileOpt?.();
    this.unsubscribeExplorerTroops?.();
    this.unsubscribeTileOpt = null;
    this.unsubscribeExplorerTroops = null;
    this.listeners.clear();
    this.chestListeners.clear();
    this.structureListeners.clear();
    this.armyListeners.clear();
    this.tileListeners.clear();
    this.chestIndex.clear();
    this.structureIndex.clear();
    this.armyIndex.clear();
    this.tileIndex.clear();
    this.tilesByTileEntity.clear();
    this.chestsByTileEntity.clear();
    this.structuresByTileEntity.clear();
  }
}
