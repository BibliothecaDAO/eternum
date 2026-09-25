import { hasSingleTilePosition } from "@bibliothecadao/eternum/game-client";
import {
  NativePresetPreimageUnavailable,
  presetPreimageCommitment,
  type VerifiedPreset,
} from "./native/preset-preimages";
import {
  expeditionEpoch,
  expeditionRealmSite,
  isCurrentExpeditionArmy,
  isRealmCategory,
} from "@bibliothecadao/eternum/expeditions";
import {
  gameSyncRegion,
  gameSyncRowKeys,
  gameSyncScopeKeys,
  isClientGameSyncModel,
  isScopedGameSyncModel,
  rowInGameSyncScope,
  syncScalar,
  type GameSyncScope,
} from "@bibliothecadao/eternum/game-sync-models";
import { nativeRuleConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import { toJsonValue, type ModelRegistry } from "./model-registry";
import { directoryFact, FINALIZED_GAME_MODELS } from "./native/read-models";
import { nativeEntityId } from "./native/entity-id";
import { rowStreamKeys, scopeInputKeys, scopeLookup } from "./subscription-keys";
import type {
  DecodedRecord,
  DecodedWorldEvent,
  FoldChange,
  FoldCheckpoint,
  FoldCheckpointRow,
  FoldRow,
  FoldSet,
  GameSnapshot,
} from "./types";

interface StoredModelRow {
  key: DecodedRecord;
  value: DecodedRecord;
}

const persistentModelNames = (registry: ModelRegistry): readonly string[] => [
  ...registry.persistent.map(({ definition }) => definition.name),
];

const asJsonRecord = (value: DecodedRecord): DecodedRecord => {
  const jsonValue = toJsonValue(value);
  if (typeof jsonValue !== "object" || jsonValue === null || Array.isArray(jsonValue)) {
    throw new Error("Decoded model did not serialize to a JSON object");
  }
  return jsonValue as DecodedRecord;
};

const compareEntityKeys = (left: FoldRow, right: FoldRow): number => {
  const leftKey = BigInt(left.key);
  const rightKey = BigInt(right.key);
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
};

const belongsToGame = (row: StoredModelRow, gameId: bigint): boolean => {
  const value = row.key.game_id;
  if (typeof value !== "bigint" && typeof value !== "number" && typeof value !== "string") {
    throw new Error("Game-scoped model row has no scalar game_id key");
  }
  return BigInt(value) === gameId;
};

const scalarGameId = (key: DecodedRecord, model: string): string => {
  const value = key.game_id;
  if (typeof value !== "bigint" && typeof value !== "number" && typeof value !== "string") {
    throw new Error(`Game-scoped model ${model} has no scalar game_id key`);
  }
  return BigInt(value).toString();
};

const checkpointRow = ([entityId, row]: [string, StoredModelRow]): FoldCheckpointRow => ({
  entity_id: entityId,
  key: asJsonRecord(row.key),
  value: asJsonRecord(row.value),
});

/**
 * A checkpoint is only restorable when it was folded from exactly the registry's persistent model set: a model added
 * to the sync manifest has rows in history the checkpoint never saw, so the fold must be rebuilt from genesis.
 * Returns the human-readable difference, or undefined when the sets match.
 */
export const checkpointModelMismatch = (registry: ModelRegistry, checkpoint: FoldCheckpoint): string | undefined => {
  if (registry.nativeSchemaIdentity !== checkpoint.native_schema_identity) return "native schema identity differs";
  const expectedModels = new Set(persistentModelNames(registry));
  const restoredModels = new Set(checkpoint.models.map(({ model }) => model));
  const missing = [...expectedModels].filter((model) => !restoredModels.has(model));
  const unexpected = [...restoredModels].filter((model) => !expectedModels.has(model));
  if (
    checkpoint.models.some(({ model, rows }) => model === "Preset" && rows.length > 0) &&
    !checkpoint.preset_preimages
  )
    return "preset registration preimages are absent";
  if (missing.length === 0 && unexpected.length === 0) return undefined;
  return `missing=${missing.join(",") || "none"}, unexpected=${unexpected.join(",") || "none"}`;
};

// The client streams the snapshot into its store one model page at a time and renders from the first pages that
// carry the world's structures and explored tiles; those go first, the rest keep registry order.
const SNAPSHOT_STREAMING_PRIORITY: readonly string[] = ["TileOpt", "TileOccupancy", "Structure"];

const orderSnapshotModelsForStreaming = <TDefinition extends { name: string }>(
  definitions: readonly TDefinition[],
): TDefinition[] => {
  const rank = (name: string) => {
    const index = SNAPSHOT_STREAMING_PRIORITY.indexOf(name);
    return index === -1 ? SNAPSHOT_STREAMING_PRIORITY.length : index;
  };
  return [...definitions].sort((left, right) => rank(left.name) - rank(right.name));
};

/** The index owner of deployment-wide rows, beside one per game. */
const DEPLOYMENT_ROWS = "deployment";

/** The keys a row is indexed by: the lookups subscriptionScope makes, and the keys a scope holds rows by. */
const indexKeys = (model: string, row: StoredModelRow, spacing: number): string[] => {
  const facts = { ...row.key, ...row.value };
  const held = gameSyncRowKeys(model, facts, spacing);
  return [...scopeInputKeys(model, facts, spacing), ...(held === "shared" ? [] : held.filter((key) => key !== "*"))];
};

/** A request for rows a finalized game no longer keeps; its review snapshot holds them. */
export class GameFinalizedError extends Error {
  constructor(
    readonly gameId: string,
    models: readonly string[],
  ) {
    super(`Game ${gameId} is finalized; its review snapshot holds ${models.join(", ")}`);
  }
}

interface ScopeIndex {
  spacing: number;
  /** Entity ids per `model|key`. */
  entityIds: Map<string, Set<string>>;
}

export class WorldFold {
  private readonly registry: ModelRegistry;

  private readonly parent?: WorldFold;

  private readonly presetPreimages = new Map<string, readonly string[]>();

  private readonly rowsByModel = new Map<string, Map<string, StoredModelRow | null>>();

  private readonly entityIdsByGameByModel = new Map<string, Map<string, Set<string>>>();

  /**
   * Built for a game on its first expedition scope and kept current as rows change, so a scope and a scoped snapshot
   * cost the scope's own rows.
   */
  private readonly scopeIndexes = new Map<string, ScopeIndex>();

  /** Finalized games whose other rows are evicted: later writes to those rows are dropped the same way. */
  private readonly evictedGames = new Set<string>();
  private invariantViolationCount = 0;
  // References canonical occupancy rows; overlay tombstones hide the parent's old position.
  private readonly structureTiles = new Map<string, string | null>();
  private directoryChanges = 0;

  public directoryRevision(): number {
    return (this.parent?.directoryRevision() ?? 0) + this.directoryChanges;
  }

  public structurePosition(gameId: string, entityId: string): Record<string, unknown> | undefined {
    const key = `${BigInt(gameId)}:${BigInt(entityId)}`;
    const tile = this.structureTile(key);
    return tile ? this.currentRow("TileOccupancy", tile)?.value : undefined;
  }

  private structureTile(key: string): string | null | undefined {
    return this.structureTiles.has(key) ? this.structureTiles.get(key) : this.parent?.structureTile(key);
  }

  private updateDirectoryIndex(model: string, entityId: string, before?: StoredModelRow, after?: StoredModelRow): void {
    const visible = (row: StoredModelRow | undefined) =>
      toJsonValue(directoryFact(model, row && { ...row.key, ...row.value }));
    if (model !== "TileOccupancy") {
      if (JSON.stringify(visible(before)) !== JSON.stringify(visible(after))) this.directoryChanges++;
      return;
    }
    const structure = (row: StoredModelRow | undefined) => {
      if (
        !row ||
        row.value.is_structure !== true ||
        !hasSingleTilePosition({
          entity_id: BigInt(row.value.entity_id as bigint),
          category: Number(row.value.category),
        })
      )
        return undefined;
      return `${BigInt(row.key.game_id as bigint)}:${BigInt(row.value.entity_id as bigint)}`;
    };
    const previous = structure(before);
    const next = structure(after);
    if (previous === next) return;
    const removed = previous && this.structureTile(previous) === entityId;
    const placed = next && this.structureTile(next) !== entityId;
    if (removed) {
      if (this.parent) this.structureTiles.set(previous, null);
      else this.structureTiles.delete(previous);
    }
    if (next) this.structureTiles.set(next, entityId);
    if (removed || placed) this.directoryChanges++;
  }

  constructor(registry: ModelRegistry, parent?: WorldFold) {
    this.registry = registry;
    this.parent = parent;
    registry.persistent.forEach(({ definition }) => {
      this.rowsByModel.set(definition.name, new Map());
      if (definition.scope === "game") this.entityIdsByGameByModel.set(definition.name, new Map());
    });
  }

  public static restore(registry: ModelRegistry, checkpoint: FoldCheckpoint): WorldFold {
    if (checkpoint.version !== 1) throw new Error(`Unsupported fold checkpoint version ${checkpoint.version}`);
    if (BigInt(checkpoint.world_address) !== BigInt(registry.worldAddress)) {
      throw new Error(`Checkpoint world ${checkpoint.world_address} does not match ${registry.worldAddress}`);
    }

    const fold = new this(registry);
    const mismatch = checkpointModelMismatch(registry, checkpoint);
    if (mismatch) throw new Error(`Checkpoint model mismatch; ${mismatch}`);

    for (const model of checkpoint.models) {
      const rows = fold.rowsByModel.get(model.model)!;
      for (const row of model.rows) {
        const stored = { key: row.key, value: row.value };
        rows.set(row.entity_id, stored);
        fold.addEntityToGameIndex(model.model, row.entity_id, stored);
        fold.updateDirectoryIndex(model.model, row.entity_id, undefined, stored);
      }
    }
    for (const preset of checkpoint.preset_preimages ?? []) {
      if (presetPreimageCommitment(preset.felts) !== BigInt(preset.commitment).toString())
        throw new Error("Checkpoint preset preimage commitment mismatch");
      fold.rememberPreset(preset);
    }
    for (const { value } of fold.modelRows("Preset")) fold.presetPreimage(String(value.commitment));
    // A checkpoint may predate a game's eviction, but no write after its finalization is kept.
    for (const gameId of fold.finalizedGameIds()) fold.evictedGames.add(gameId);
    return fold;
  }

  public apply(event: DecodedWorldEvent, onDerivedRow?: (change: FoldChange) => void): FoldChange | undefined {
    if (event.kind === "event") {
      this.applyEventRows(event).forEach((change) => onDerivedRow?.(change));
      return {
        event: true,
        gameId: this.eventGameId(event),
        set: {
          key: event.entityId,
          model: event.model.name,
          value: asJsonRecord({ ...event.key, ...event.value }),
        },
      };
    }

    const rows = this.rowsByModel.get(event.model.name);
    if (!rows) throw new Error(`Store event ${event.model.name} is not a persistent sync model`);

    const gameId = this.eventGameId(event);
    if (gameId !== undefined && this.isEvicted(gameId, event.model.name)) return undefined;
    const existing = this.storedRow(event.model.name, event.entityId);
    if (event.kind === "delete" && !existing) return undefined;

    const previous = this.currentRow(event.model.name, event.entityId);
    if (event.kind === "set") {
      rows.set(event.entityId, { key: event.key, value: event.value });
    } else if (event.kind === "delete") {
      if (this.parent) rows.set(event.entityId, null);
      else rows.delete(event.entityId);
    } else if (!existing) {
      return this.reportInvariantViolation(event, "write to a row the fold does not hold");
    } else if (event.kind === "update") {
      rows.set(event.entityId, { key: existing.key, value: event.value });
    } else {
      rows.set(event.entityId, {
        key: existing.key,
        value: { ...existing.value, [event.member]: event.value },
      });
    }

    this.updateGameIndex(event.model.name, event.entityId, existing, rows.get(event.entityId) ?? undefined);
    this.updateDirectoryIndex(event.model.name, event.entityId, existing, rows.get(event.entityId) ?? undefined);
    if (!this.parent) this.updateScopeIndex(event.model.name, event.entityId, existing, rows.get(event.entityId));

    if (event.kind === "delete") return { del: { key: event.entityId, model: event.model.name }, gameId, previous };
    return { gameId, set: this.currentRow(event.model.name, event.entityId)!, previous };
  }

  public currentRow(model: string, entityId: string): FoldSet | undefined {
    const row = this.storedRow(model, entityId);
    return row ? { key: entityId, model, value: asJsonRecord({ ...row.key, ...row.value }) } : undefined;
  }

  public checkpoint(): FoldCheckpoint {
    return {
      models: persistentModelNames(this.registry).map((model) => ({
        model,
        rows: [...this.materializedRows(model).entries()].map(checkpointRow).sort((left, right) => {
          const leftKey = BigInt(left.entity_id);
          const rightKey = BigInt(right.entity_id);
          return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
        }),
      })),
      preset_preimages: [...this.allPresetPreimages()].map(([commitment, felts]) => ({ commitment, felts })),
      version: 1,
      native_schema_identity: this.registry.nativeSchemaIdentity,
      world_address: this.registry.worldAddress,
    };
  }

  public rememberPreset({ commitment, felts }: VerifiedPreset): void {
    this.presetPreimages.set(BigInt(commitment).toString(), Object.freeze([...felts]));
  }

  public presetPreimage(commitment: string): readonly string[] {
    const key = BigInt(commitment).toString();
    const felts = this.presetPreimages.get(key) ?? this.parent?.presetPreimage(key);
    if (!felts) throw new NativePresetPreimageUnavailable(key);
    return felts;
  }

  private allPresetPreimages(): Map<string, readonly string[]> {
    return new Map([...(this.parent?.allPresetPreimages() ?? []), ...this.presetPreimages]);
  }

  public overlay(): WorldFold {
    return new WorldFold(this.registry, this);
  }

  /** Every client fact, including those marked for eviction: a review is frozen before eviction. */
  public reviewSnapshot(gameId: string | number | bigint, confirmedBlock: number): GameSnapshot {
    return this.snapshotRows(gameId, confirmedBlock);
  }

  /** Chain events this confirmed fold skipped because they broke a contract invariant (see reportInvariantViolation). */
  public get invariantViolations(): number {
    return this.invariantViolationCount;
  }

  public retainedRowCount(): number {
    return persistentModelNames(this.registry).reduce((total, model) => total + this.materializedRows(model).size, 0);
  }

  public modelRows(model: string): FoldRow[] {
    return [...this.materializedRows(model).entries()]
      .map(([key, row]) => ({ key, value: asJsonRecord({ ...row.key, ...row.value }) }))
      .sort(compareEntityKeys);
  }

  public gameIds(): readonly string[] {
    if (!this.rowsByModel.has("GameRegistry")) return [];
    return [...this.materializedRows("GameRegistry").values()]
      .map((row) => scalarGameId(row.key, "GameRegistry"))
      .sort((left, right) => Number(left) - Number(right));
  }

  public snapshot(
    gameId: string | number | bigint,
    confirmedBlock: number,
    models?: readonly string[],
    scope?: GameSyncScope,
  ): GameSnapshot {
    this.refuseEvictedModels(BigInt(gameId).toString(), models);
    return this.snapshotRows(gameId, confirmedBlock, models, scope);
  }

  public gameRows(model: string, gameId: string): FoldRow[] {
    return [...this.materializedGameRows(model, BigInt(gameId)).entries()].map(([key, row]) => ({
      key,
      value: asJsonRecord({ ...row.key, ...row.value }),
    }));
  }

  public subscriptionScope(gameId: string, actor: string | undefined, timestamp: number): GameSyncScope {
    if (actor !== undefined && (BigInt(actor) <= 0n || BigInt(actor) >= (1n << 251n) - 256n))
      throw new Error("Invalid gameplay account");
    const scope: GameSyncScope = { actor };
    const expedition = this.expeditionRules(gameId);
    if (!expedition) return scope;
    const { spacing } = expedition;
    const epoch = expeditionEpoch(expedition, timestamp);
    const owners = new Set<string>(actor === undefined ? [] : [syncScalar(actor)]);
    if (actor !== undefined)
      for (const { value } of this.scopeRows("PlayerEntry", gameId, spacing, [scopeLookup.entryOf(actor)]))
        owners.add(syncScalar(value.owner));
    const homes = this.scopeRows("Structure", gameId, spacing, [...owners].map(scopeLookup.structuresOf)).filter(
      ({ value }) => isRealmCategory(Number((value.base as DecodedRecord).category)),
    );
    const realms = new Set(homes.map(({ value }) => syncScalar(value.entity_id)));
    const realmTraits = new Set(homes.map(({ value }) => syncScalar((value.metadata as DecodedRecord).realm_id)));
    const regions = new Set<string>();
    const armies = this.scopeRows("ExplorerTroops", gameId, spacing, [...realms].map(scopeLookup.armiesOf)).filter(
      ({ value }) => {
        if (BigInt((value.troops as DecodedRecord).count as string) <= 0n) return false;
        const coord = this.entityPosition(gameId, spacing, value.explorer_id);
        return isCurrentExpeditionArmy(
          expedition,
          { x: Number(coord.x), y: Number(coord.y), alt: coord.alt === true },
          timestamp,
        );
      },
    );
    // With no current army, morning muster starts on the surface, at the site the contract raises the realm on today.
    if (epoch >= 0 && armies.length === 0)
      for (const realm of realmTraits) {
        const site = expeditionRealmSite(expedition, Number(realm), timestamp);
        regions.add(gameSyncRegion({ alt: false, x: site.col, y: site.row }, spacing)!);
      }
    for (const { value } of armies) {
      const region = gameSyncRegion(this.entityPosition(gameId, spacing, value.explorer_id), spacing);
      if (region !== undefined) regions.add(region);
    }
    const entities = new Set([...realms, ...armies.map(({ value }) => syncScalar(value.explorer_id))]);
    for (const { value } of this.scopeRows(
      "TileOccupancy",
      gameId,
      spacing,
      [...regions].map(scopeLookup.occupancyIn),
    )) {
      if (
        value.is_structure === true &&
        hasSingleTilePosition({ entity_id: syncScalar(value.entity_id), category: syncScalar(value.category) })
      )
        entities.add(syncScalar(value.entity_id));
    }
    const productionSources = new Set(
      this.scopeRows("ProductionReceiver", gameId, spacing, [...realms].map(scopeLookup.receiversOf)).map(({ value }) =>
        syncScalar(value.entity_id),
      ),
    );
    scope.expedition = { epoch, spacing, owners, realms, realmTraits, regions, entities, productionSources };
    return scope;
  }

  private entityPosition(gameId: string, spacing: number, entityId: unknown): DecodedRecord {
    const positions = this.scopeRows("TileOccupancy", gameId, spacing, [scopeLookup.occupancyOf(entityId)]);
    if (positions.length !== 1) throw new Error(`Expected one position for entity ${gameId}:${syncScalar(entityId)}`);
    const { value } = positions[0]!;
    return { x: value.col, y: value.row, alt: value.alt };
  }

  /**
   * The game's expedition clock and grid, read once for scopes, their expiry and routing: null for a game without
   * expeditions or not yet created. A game with expedition rules but no game or settlement rules is refused.
   */
  private expeditionRules(gameId: string): { epochSeconds: number; spacing: number; startMainAt: number } | null {
    const rules = this.gameRows("SliceRules", gameId)[0]?.value;
    const game = this.gameRows("GameRegistry", gameId)[0]?.value;
    if (!rules && game) throw new Error("Game subscription requires its rules");
    if (!rules || Number(rules.epoch_seconds) === 0) return null;
    const settlement = this.gameRows("SettlementRules", gameId)[0]?.value;
    if (!game || !settlement || Number(settlement.spacing) <= 0)
      throw new Error("Expedition scope requires game and settlement rules");
    return {
      epochSeconds: Number(rules.epoch_seconds),
      spacing: Number(settlement.spacing),
      startMainAt: Number(game.start_main_at),
    };
  }

  /** The first timestamp at which the scope must be taken again: the game's start, or the expedition's rollover. */
  public scopeValidUntil(gameId: string, timestamp: number): number {
    const expedition = this.expeditionRules(gameId);
    if (!expedition) return Number.POSITIVE_INFINITY;
    const { epochSeconds, startMainAt } = expedition;
    const rollover = (Math.floor(timestamp / epochSeconds) + 1) * epochSeconds;
    return timestamp < startMainAt ? Math.min(startMainAt, rollover) : rollover;
  }

  public subscriptionSnapshot(
    gameId: string,
    block: number,
    scope: GameSyncScope,
    models?: readonly string[],
  ): GameSnapshot {
    return this.snapshot(gameId, block, models, scope);
  }

  /**
   * Narrows every model with an `owner` to one account's rows: those it owns, and those owned by one of its structures
   * (an army's owner is its home structure). An account is a felt far above any structure id, so one rule covers both.
   * Models without an owner pass whole.
   */
  public ownedBy(gameId: string, snapshot: GameSnapshot, account: string): GameSnapshot {
    const owner = BigInt(account);
    if (owner <= 0n || owner >= (1n << 251n) - 256n) throw new Error("Invalid owner account");
    const structures = new Set(
      [...this.materializedGameRows("Structure", BigInt(gameId)).values()]
        .filter(({ value }) => BigInt(value.owner as bigint) === owner)
        .map(({ key }) => BigInt(key.entity_id as bigint)),
    );
    const owns = (value: DecodedRecord) =>
      value.owner === undefined ||
      BigInt(value.owner as string) === owner ||
      structures.has(BigInt(value.owner as string));
    return {
      ...snapshot,
      models: snapshot.models.map(({ model, rows }) => ({ model, rows: rows.filter(({ value }) => owns(value)) })),
    };
  }

  /** How this game's changed rows reach subscriptions: rowStreamKeys on the expedition grid, if the game has one. */
  public streamKeys(gameId: string): (row: FoldSet) => readonly string[] | "everyone" {
    const spacing = this.expeditionRules(gameId)?.spacing;
    return (row) => rowStreamKeys(row.model, row.value, spacing);
  }

  public finalizedGameIds(): readonly string[] {
    const rules = new Map(
      this.modelRows("SliceRules").map(({ value }) => [BigInt(value.game_id as string).toString(), value]),
    );
    const results = new Set(
      this.modelRows("BlitzResult")
        .filter(({ value }) => value.complete === true)
        .map(({ value }) => BigInt(value.game_id as string).toString()),
    );
    return this.modelRows("GameRegistry")
      .filter(({ value }) => {
        if (value.settled !== true) return false;
        const gameId = BigInt(value.game_id as string).toString();
        const config = rules.get(gameId);
        if (!config) throw new Error(`Finalized game ${gameId} has no rules`);
        return (Number(config.mode_rules) & nativeRuleConstants.SEASON_CLOSE) !== 0 || results.has(gameId);
      })
      .map(({ value }) => BigInt(value.game_id as string).toString());
  }

  /** Drops each finalized game's rows beyond its directory and standings; call once its review snapshot is frozen. */
  public evictFinalizedGames(): void {
    if (this.parent) throw new Error("Only the confirmed fold evicts finalized games");
    for (const gameId of this.finalizedGameIds()) {
      this.evictedGames.add(gameId);
      this.scopeIndexes.delete(gameId);
      for (const [model, games] of this.entityIdsByGameByModel) {
        if (FINALIZED_GAME_MODELS.has(model)) continue;
        const rows = this.rowsByModel.get(model)!;
        for (const entityId of games.get(gameId) ?? []) rows.delete(entityId);
        games.delete(gameId);
      }
    }
  }

  public gameplayAccounts(gameId: string | number | bigint): ReadonlySet<string> {
    return new Set(
      this.modelRows("PlayerEntry")
        .filter(({ value }) => BigInt(value.game_id as string) === BigInt(gameId))
        .map(({ value }) => `0x${BigInt(value.player as string).toString(16)}`),
    );
  }

  private snapshotRows(
    gameIdInput: string | number | bigint,
    confirmedBlock: number,
    requestedModels?: readonly string[],
    scope?: GameSyncScope,
  ): GameSnapshot {
    const gameId = BigInt(gameIdInput);
    const definitions = this.snapshotDefinitions(requestedModels);
    const scopeKeys = scope?.expedition ? gameSyncScopeKeys(scope) : undefined;
    const models = definitions.map((definition) => {
      const gameRows = this.snapshotModelRows(definition, gameId, scope, scopeKeys)
        .map(([key, row]): FoldRow => ({ key, value: asJsonRecord({ ...row.key, ...row.value }) }))
        .sort(compareEntityKeys);
      return { model: definition.name, rows: gameRows };
    });

    return {
      game_id: gameId.toString(),
      confirmed_block: confirmedBlock,
      models,
    };
  }

  private snapshotDefinitions(requestedModels?: readonly string[]) {
    const definitions = this.registry.persistent
      .map(({ definition }) => definition)
      .filter(({ name }) => isClientGameSyncModel(name));
    if (!requestedModels || requestedModels.length === 0) {
      return orderSnapshotModelsForStreaming(definitions);
    }

    const requested = new Set(requestedModels);
    const available = new Set(definitions.map(({ name }) => name));
    const missing = [...requested].filter((model) => !available.has(model));
    if (missing.length > 0) throw new Error(`Unknown snapshot models: ${missing.join(", ")}`);
    return orderSnapshotModelsForStreaming(definitions.filter(({ name }) => requested.has(name)));
  }

  /**
   * A model's rows in a snapshot: every row; with a scope, the rows it holds. An expedition scope finds its rows through
   * the index, so a scoped snapshot costs the scope's rows, not the game's.
   */
  private snapshotModelRows(
    definition: { name: string; scope: "game" | "deployment" },
    gameId: bigint,
    scope?: GameSyncScope,
    scopeKeys?: ReadonlySet<string>,
  ): [string, StoredModelRow][] {
    const { name } = definition;
    const owner = definition.scope === "deployment" ? DEPLOYMENT_ROWS : gameId.toString();
    if (scope?.expedition && scopeKeys && isScopedGameSyncModel(name, true))
      return [...this.scopeEntityIds(name, owner, scope.expedition.spacing, scopeKeys)].map((entityId) => [
        entityId,
        this.storedRow(name, entityId)!,
      ]);
    const rows = [
      ...(owner === DEPLOYMENT_ROWS ? this.materializedRows(name) : this.materializedGameRows(name, gameId)).entries(),
    ];
    return scope ? rows.filter(([, row]) => rowInGameSyncScope(name, { ...row.key, ...row.value }, scope)) : rows;
  }

  /** The game's rows of a scope model matching any of these index keys. */
  private scopeRows(model: string, gameId: string, spacing: number, keys: readonly string[]): FoldRow[] {
    return [...this.scopeEntityIds(model, gameId, spacing, new Set(keys))].map((key) => {
      const row = this.storedRow(model, key)!;
      return { key, value: asJsonRecord({ ...row.key, ...row.value }) };
    });
  }

  /** Entity ids of a model's rows, in a game or deployment-wide, with any of these index keys. */
  private scopeEntityIds(model: string, owner: string, spacing: number, keys: ReadonlySet<string>): Set<string> {
    if (!this.parent) {
      const index = this.scopeIndex(owner, spacing);
      const entityIds = new Set<string>();
      for (const key of keys) for (const entityId of index.get(`${model}|${key}`) ?? []) entityIds.add(entityId);
      return entityIds;
    }
    // An overlay corrects its parent's answer with the few rows it changed.
    const entityIds = this.parent.scopeEntityIds(model, owner, spacing, keys);
    const rows = this.rowsByModel.get(model)!;
    const changed =
      owner === DEPLOYMENT_ROWS ? rows.keys() : (this.entityIdsByGameByModel.get(model)?.get(owner) ?? []);
    for (const entityId of changed) {
      const row = rows.get(entityId);
      entityIds.delete(entityId);
      if (row && indexKeys(model, row, spacing).some((key) => keys.has(key))) entityIds.add(entityId);
    }
    return entityIds;
  }

  private scopeIndex(owner: string, spacing: number): Map<string, Set<string>> {
    const existing = this.scopeIndexes.get(owner);
    // Deployment-wide rows carry no region, so their keys do not depend on a game's spacing.
    if (existing && (owner === DEPLOYMENT_ROWS || existing.spacing === spacing)) return existing.entityIds;
    const index: ScopeIndex = { spacing, entityIds: new Map() };
    this.scopeIndexes.set(owner, index);
    for (const { definition } of this.registry.persistent) {
      if (!isScopedGameSyncModel(definition.name, true)) continue;
      if ((definition.scope === "deployment") !== (owner === DEPLOYMENT_ROWS)) continue;
      const rows =
        owner === DEPLOYMENT_ROWS
          ? this.materializedRows(definition.name)
          : this.materializedGameRows(definition.name, BigInt(owner));
      for (const [entityId, row] of rows) this.addToScopeIndex(definition.name, entityId, row);
    }
    return index.entityIds;
  }

  private updateScopeIndex(
    model: string,
    entityId: string,
    previous: StoredModelRow | undefined,
    current: StoredModelRow | null | undefined,
  ): void {
    if (!isScopedGameSyncModel(model, true)) return;
    if (previous) this.removeFromScopeIndex(model, entityId, previous);
    if (current) this.addToScopeIndex(model, entityId, current);
  }

  private scopeIndexOwner(model: string, row: StoredModelRow): string {
    return this.entityIdsByGameByModel.has(model) ? scalarGameId(row.key, model) : DEPLOYMENT_ROWS;
  }

  private addToScopeIndex(model: string, entityId: string, row: StoredModelRow): void {
    const index = this.scopeIndexes.get(this.scopeIndexOwner(model, row));
    if (!index) return;
    for (const key of indexKeys(model, row, index.spacing)) {
      const entityIds = index.entityIds.get(`${model}|${key}`) ?? new Set<string>();
      entityIds.add(entityId);
      index.entityIds.set(`${model}|${key}`, entityIds);
    }
  }

  private removeFromScopeIndex(model: string, entityId: string, row: StoredModelRow): void {
    const index = this.scopeIndexes.get(this.scopeIndexOwner(model, row));
    if (!index) return;
    for (const key of indexKeys(model, row, index.spacing)) {
      const entityIds = index.entityIds.get(`${model}|${key}`);
      entityIds?.delete(entityId);
      if (entityIds?.size === 0) index.entityIds.delete(`${model}|${key}`);
    }
  }

  private eventGameId(event: DecodedWorldEvent): string | undefined {
    if (event.kind === "event" && event.value.game_id !== undefined) return scalarGameId(event.value, event.model.name);
    if (event.model.scope === "deployment") return undefined;
    return scalarGameId(event.key, event.model.name);
  }

  private refuseEvictedModels(gameId: string, models?: readonly string[]): void {
    const evicted = this.snapshotDefinitions(models).filter(
      ({ name, scope }) => scope === "game" && this.isEvicted(gameId, name),
    );
    if (evicted.length > 0)
      throw new GameFinalizedError(
        gameId,
        evicted.map(({ name }) => name),
      );
  }

  private isEvicted(gameId: string, model: string): boolean {
    const evicted = this.parent ? this.parent.isEvicted(gameId, model) : this.evictedGames.has(gameId);
    return evicted && !FINALIZED_GAME_MODELS.has(model);
  }

  private storedRow(model: string, entityId: string): StoredModelRow | undefined {
    const rows = this.rowsByModel.get(model);
    if (!rows) return undefined;
    if (rows.has(entityId)) return rows.get(entityId) ?? undefined;
    return this.parent?.storedRow(model, entityId);
  }

  private materializedRows(model: string): Map<string, StoredModelRow> {
    const materialized = this.parent ? this.parent.materializedRows(model) : new Map<string, StoredModelRow>();
    const rows = this.rowsByModel.get(model);
    if (!rows) throw new Error(`Fold has no row collection for ${model}`);
    for (const [entityId, row] of rows) {
      if (row) materialized.set(entityId, row);
      else materialized.delete(entityId);
    }
    return materialized;
  }

  private materializedGameRows(model: string, gameId: bigint): Map<string, StoredModelRow> {
    const materialized = this.parent
      ? this.parent.materializedGameRows(model, gameId)
      : new Map<string, StoredModelRow>();
    const rows = this.rowsByModel.get(model);
    const entityIds = this.entityIdsByGameByModel.get(model)?.get(gameId.toString());
    if (!rows) throw new Error(`Fold has no row collection for ${model}`);
    if (!entityIds) return materialized;

    for (const entityId of entityIds) {
      const row = rows.get(entityId);
      if (row && belongsToGame(row, gameId)) materialized.set(entityId, row);
      else materialized.delete(entityId);
    }
    return materialized;
  }

  private updateGameIndex(
    model: string,
    entityId: string,
    previous: StoredModelRow | undefined,
    current: StoredModelRow | undefined,
  ): void {
    if (!this.entityIdsByGameByModel.has(model)) return;
    if (this.parent) {
      if (previous) this.addEntityToGameIndex(model, entityId, previous);
      if (current) this.addEntityToGameIndex(model, entityId, current);
      return;
    }

    if (previous) this.removeEntityFromGameIndex(model, entityId, previous);
    if (current) this.addEntityToGameIndex(model, entityId, current);
  }

  private addEntityToGameIndex(model: string, entityId: string, row: StoredModelRow): void {
    const games = this.entityIdsByGameByModel.get(model);
    if (!games) return;
    const gameId = scalarGameId(row.key, model);
    const entityIds = games.get(gameId) ?? new Set<string>();
    entityIds.add(entityId);
    games.set(gameId, entityIds);
  }

  private removeEntityFromGameIndex(model: string, entityId: string, row: StoredModelRow): void {
    const games = this.entityIdsByGameByModel.get(model);
    if (!games) return;
    const gameId = scalarGameId(row.key, model);
    const entityIds = games.get(gameId);
    if (!entityIds) return;
    entityIds.delete(entityId);
    if (entityIds.size === 0) games.delete(gameId);
  }

  /**
   * An event the contracts cannot emit, skipped whole so no held row changes. One bad event never stops a shard: the
   * confirmed fold reports and counts it, and a pre-confirmed overlay stays quiet because the confirmed fold reports the
   * same event when its block lands.
   */
  private reportInvariantViolation(event: DecodedWorldEvent, reason: string): undefined {
    if (this.parent) return undefined;
    this.invariantViolationCount += 1;
    console.error(
      JSON.stringify({
        block: event.position.blockNumber,
        entityId: event.entityId,
        event: "herald_invariant_violation",
        eventIndex: event.position.eventIndex,
        key: toJsonValue(event.key),
        kind: event.kind,
        model: event.model.name,
        reason,
        transactionHash: event.position.transactionHash,
      }),
    );
    return undefined;
  }

  private applyEventRows(event: Extract<DecodedWorldEvent, { kind: "event" }>): FoldChange[] {
    if (event.model.name === "PointsAwarded") return this.applyPointsAward(event);
    if (event.model.name !== "ExecutionRecorded") return [];
    const { order, status, status_class, reason } = event.value;
    const result = BigInt(String(status));
    const code = BigInt(String(status_class));
    if (
      BigInt(String(order)) === 0n ||
      !(
        (result === 1n && code === 0n && reason === "") ||
        (result === 2n && code !== 0n && typeof reason === "string" && reason.length > 0)
      )
    )
      throw new Error("Invalid native execution outcome");
    return [];
  }

  private applyPointsAward(event: Extract<DecodedWorldEvent, { kind: "event" }>): FoldChange[] {
    const { game_id, player } = event.key;
    const { player_points, season_points } = event.value;
    return [
      {
        model: "PlayerPoints",
        keys: [game_id, player],
        key: { game_id, address: player },
        value: { points: player_points },
      },
      { model: "PointsTotal", keys: [game_id], key: { game_id }, value: { total: season_points } },
    ].flatMap(({ model, keys, key, value }) => {
      const codec = this.registry.persistent.find(({ definition }) => definition.name === model);
      if (!codec) throw new Error(`Missing native points schema: ${model}`);
      const change = this.apply({
        kind: "set",
        model: codec.definition,
        entityId: nativeEntityId(keys.map(String)),
        position: event.position,
        key,
        value,
      });
      return change ? [change] : [];
    });
  }
}
