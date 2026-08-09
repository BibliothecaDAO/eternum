#!/usr/bin/env bun
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import {
  formatError,
  hasFlag,
  optionalInteger,
  optionalString,
  parseCliArgs,
  requirePositiveInteger,
  requireString,
  writeJsonReport,
} from "./shared/cli";

const NAMESPACE = "s2_blitz";
const GAME_REGISTRY_TABLE = `${NAMESPACE}-GameRegistry`;

interface GameRecord {
  gameId: number;
  status: string;
  endAt: number;
}

interface ModelTablePlan {
  table: string;
  modelId: string;
  rows: number;
}

interface RelationPair {
  entityId: string;
  modelId: string;
}

interface DatabaseMetrics {
  databaseBytes: number;
  walBytes: number;
  shmBytes: number;
  pageSize: number;
  pageCount: number;
  freePages: number;
  logicalBytes: number;
}

export interface GamePruneSelection {
  gameIds?: number[];
  settledOlderThanDays?: number;
  nowSeconds?: number;
}

export interface GamePruneOptions {
  dbPath: string;
  selection: GamePruneSelection;
  execute?: boolean;
  confirmOffline?: boolean;
  vacuum?: boolean;
}

export interface GamePrunePlan {
  dbPath: string;
  targets: GameRecord[];
  targetKeyPrefixes: string[];
  modelTables: ModelTablePlan[];
  entityRelations: RelationPair[];
  eventRelations: RelationPair[];
  orphanEntityIds: string[];
  orphanEventMessageIds: string[];
  historicalEntityRows: number;
  historicalEventMessageRows: number;
  metricsBefore: DatabaseMetrics;
}

function quoteIdentifier(identifier: string): string {
  if (!/^s2_blitz-[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQLite identifier "${identifier}"`);
  }
  return `"${identifier}"`;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(",");
}

function parseStoredInteger(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(BigInt(value));
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error(`Invalid ${label}: ${String(value)}`);
}

function readMetrics(db: Database, dbPath: string): DatabaseMetrics {
  const pageSize = Number((db.query("PRAGMA page_size").get() as { page_size: number }).page_size);
  const pageCount = Number((db.query("PRAGMA page_count").get() as { page_count: number }).page_count);
  const freePages = Number((db.query("PRAGMA freelist_count").get() as { freelist_count: number }).freelist_count);
  return {
    databaseBytes: fileSize(dbPath),
    walBytes: fileSize(`${dbPath}-wal`),
    shmBytes: fileSize(`${dbPath}-shm`),
    pageSize,
    pageCount,
    freePages,
    logicalBytes: pageSize * pageCount,
  };
}

function fileSize(filePath: string): number {
  return existsSync(filePath) ? statSync(filePath).size : 0;
}

function readGameRecords(db: Database): GameRecord[] {
  const rows = db
    .query(`SELECT game_id, status, end_at FROM ${quoteIdentifier(GAME_REGISTRY_TABLE)} ORDER BY game_id`)
    .all() as Array<{ game_id: unknown; status: unknown; end_at: unknown }>;
  return rows.map((row) => ({
    gameId: parseStoredInteger(row.game_id, "game_id"),
    status: String(row.status),
    endAt: parseStoredInteger(row.end_at, "end_at"),
  }));
}

function resolveTargets(records: GameRecord[], selection: GamePruneSelection): GameRecord[] {
  const hasExplicitIds = Boolean(selection.gameIds?.length);
  const hasAgeSelector = selection.settledOlderThanDays !== undefined;
  if (hasExplicitIds === hasAgeSelector) {
    throw new Error("Select games with exactly one of gameIds or settledOlderThanDays");
  }

  const targets = hasExplicitIds
    ? resolveExplicitTargets(records, selection.gameIds!)
    : resolveAgeTargets(records, selection.settledOlderThanDays!, selection.nowSeconds);
  if (targets.length === 0) {
    throw new Error("The prune selector matched no settled games");
  }

  const unsafeTarget = targets.find((target) => target.status !== "Settled");
  if (unsafeTarget) {
    throw new Error(`Refusing to prune game ${unsafeTarget.gameId}: status is ${unsafeTarget.status}, not Settled`);
  }
  return targets;
}

function resolveExplicitTargets(records: GameRecord[], gameIds: number[]): GameRecord[] {
  const uniqueIds = [...new Set(gameIds)].sort((left, right) => left - right);
  if (uniqueIds.some((gameId) => !Number.isSafeInteger(gameId) || gameId <= 0)) {
    throw new Error("gameIds must contain positive safe integers");
  }

  const recordById = new Map(records.map((record) => [record.gameId, record]));
  return uniqueIds.map((gameId) => {
    const record = recordById.get(gameId);
    if (!record) {
      throw new Error(`Game ${gameId} does not exist in ${GAME_REGISTRY_TABLE}`);
    }
    return record;
  });
}

function resolveAgeTargets(records: GameRecord[], days: number, nowSeconds = Math.floor(Date.now() / 1_000)): GameRecord[] {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("settledOlderThanDays must be positive");
  }
  const cutoff = nowSeconds - days * 86_400;
  return records.filter((record) => record.status === "Settled" && record.endAt <= cutoff);
}

function gameKeyPrefix(gameId: number): string {
  return `0x${BigInt(gameId).toString(16).padStart(64, "0")}/`;
}

function discoverGameModelTables(db: Database): Array<{ table: string; modelId: string }> {
  const tables = db
    .query("SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE 's2_blitz-%' ORDER BY name")
    .all() as Array<{ name: string }>;

  return tables.flatMap(({ name: table }) => {
    const columns = db.query(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "game_id")) {
      return [];
    }

    const modelName = table.slice(`${NAMESPACE}-`.length);
    const model = db
      .query("SELECT id FROM models WHERE namespace = ? AND name = ? LIMIT 1")
      .get(NAMESPACE, modelName) as { id?: string } | null;
    if (!model?.id) {
      throw new Error(`No models row found for ${table}`);
    }
    return [{ table, modelId: model.id }];
  });
}

function relationKey(pair: RelationPair): string {
  return `${pair.entityId}\u0000${pair.modelId}`;
}

function collectTablePlan(
  db: Database,
  tables: Array<{ table: string; modelId: string }>,
  gameIds: number[],
): { tables: ModelTablePlan[]; entityRelations: RelationPair[]; eventRelations: RelationPair[] } {
  const targetPlaceholders = placeholders(gameIds.length);
  const entityRelationMap = new Map<string, RelationPair>();
  const eventRelationMap = new Map<string, RelationPair>();
  const tablePlans = tables.map(({ table, modelId }) => {
    const rows = db
      .query(
        `SELECT internal_entity_id, internal_event_message_id FROM ${quoteIdentifier(table)} WHERE game_id IN (${targetPlaceholders})`,
      )
      .all(...gameIds) as Array<{ internal_entity_id?: string; internal_event_message_id?: string }>;
    for (const row of rows) {
      if (row.internal_entity_id) {
        const pair = { entityId: row.internal_entity_id, modelId };
        entityRelationMap.set(relationKey(pair), pair);
      }
      if (row.internal_event_message_id) {
        const pair = { entityId: row.internal_event_message_id, modelId };
        eventRelationMap.set(relationKey(pair), pair);
      }
    }
    return { table, modelId, rows: rows.length };
  });

  return {
    tables: tablePlans,
    entityRelations: [...entityRelationMap.values()],
    eventRelations: [...eventRelationMap.values()],
  };
}

function findOrphansAfterRelationRemoval(
  db: Database,
  relationTable: "entity_model" | "event_model",
  pairs: RelationPair[],
  keyTable: "entities" | "event_messages",
  targetKeyPrefixes: string[],
): string[] {
  const pairsByEntity = groupRelationsByEntity(pairs);
  const orphans: string[] = [];

  for (const [entityId, entityPairs] of pairsByEntity) {
    const selectedModelIds = entityPairs.map((pair) => pair.modelId);
    const remaining = db
      .query(
        `SELECT COUNT(*) AS count FROM ${relationTable} WHERE entity_id = ? AND model_id NOT IN (${placeholders(selectedModelIds.length)})`,
      )
      .get(entityId, ...selectedModelIds) as { count: number };
    if (Number(remaining.count) > 0) {
      continue;
    }

    const keyRow = db.query(`SELECT keys FROM ${keyTable} WHERE id = ?`).get(entityId) as { keys?: string } | null;
    if (keyRow?.keys && targetKeyPrefixes.some((prefix) => keyRow.keys!.startsWith(prefix))) {
      orphans.push(entityId);
    }
  }

  return orphans.sort();
}

function groupRelationsByEntity(pairs: RelationPair[]): Map<string, RelationPair[]> {
  const grouped = new Map<string, RelationPair[]>();
  for (const pair of pairs) {
    const entityPairs = grouped.get(pair.entityId) ?? [];
    entityPairs.push(pair);
    grouped.set(pair.entityId, entityPairs);
  }
  return grouped;
}

function countHistoricalRows(
  db: Database,
  table: "entities_historical" | "event_messages_historical",
  modelIds: string[],
  keyPrefixes: string[],
): number {
  if (modelIds.length === 0) {
    return 0;
  }
  const keyConditions = keyPrefixes.map(() => "keys LIKE ?").join(" OR ");
  const row = db
    .query(
      `SELECT COUNT(*) AS count FROM ${table} WHERE model_id IN (${placeholders(modelIds.length)}) AND (${keyConditions})`,
    )
    .get(...modelIds, ...keyPrefixes.map((prefix) => `${prefix}%`)) as { count: number };
  return Number(row.count);
}

export function planGamePrune(dbPath: string, selection: GamePruneSelection): GamePrunePlan {
  const resolvedPath = path.resolve(dbPath);
  const db = new Database(resolvedPath, { readonly: true, strict: true });

  try {
    const targets = resolveTargets(readGameRecords(db), selection);
    const gameIds = targets.map((target) => target.gameId);
    const targetKeyPrefixes = gameIds.map(gameKeyPrefix);
    const tablePlan = collectTablePlan(db, discoverGameModelTables(db), gameIds);
    const modelIds = [...new Set(tablePlan.tables.map((table) => table.modelId))];

    return {
      dbPath: resolvedPath,
      targets,
      targetKeyPrefixes,
      modelTables: tablePlan.tables,
      entityRelations: tablePlan.entityRelations,
      eventRelations: tablePlan.eventRelations,
      orphanEntityIds: findOrphansAfterRelationRemoval(
        db,
        "entity_model",
        tablePlan.entityRelations,
        "entities",
        targetKeyPrefixes,
      ),
      orphanEventMessageIds: findOrphansAfterRelationRemoval(
        db,
        "event_model",
        tablePlan.eventRelations,
        "event_messages",
        targetKeyPrefixes,
      ),
      historicalEntityRows: countHistoricalRows(db, "entities_historical", modelIds, targetKeyPrefixes),
      historicalEventMessageRows: countHistoricalRows(
        db,
        "event_messages_historical",
        modelIds,
        targetKeyPrefixes,
      ),
      metricsBefore: readMetrics(db, resolvedPath),
    };
  } finally {
    db.close();
  }
}

function deleteRelations(
  db: Database,
  relationTable: "entity_model" | "event_model",
  pairs: RelationPair[],
): number {
  const statement = db.prepare(`DELETE FROM ${relationTable} WHERE entity_id = ? AND model_id = ?`);
  let deleted = 0;
  for (const pair of pairs) {
    deleted += Number(statement.run(pair.entityId, pair.modelId).changes);
  }
  return deleted;
}

function deleteByIds(db: Database, table: "entities" | "event_messages", ids: string[]): number {
  if (ids.length === 0) {
    return 0;
  }
  return Number(db.query(`DELETE FROM ${table} WHERE id IN (${placeholders(ids.length)})`).run(...ids).changes);
}

function deleteHistoricalRows(
  db: Database,
  table: "entities_historical" | "event_messages_historical",
  modelIds: string[],
  keyPrefixes: string[],
): number {
  if (modelIds.length === 0) {
    return 0;
  }
  const keyConditions = keyPrefixes.map(() => "keys LIKE ?").join(" OR ");
  return Number(
    db
      .query(
        `DELETE FROM ${table} WHERE model_id IN (${placeholders(modelIds.length)}) AND (${keyConditions})`,
      )
      .run(...modelIds, ...keyPrefixes.map((prefix) => `${prefix}%`)).changes,
  );
}

function executePlan(db: Database, plan: GamePrunePlan): object {
  const gameIds = plan.targets.map((target) => target.gameId);
  const targetPlaceholders = placeholders(gameIds.length);
  const modelTableRows: Record<string, number> = {};
  const modelIds = [...new Set(plan.modelTables.map((table) => table.modelId))];

  return db.transaction(() => {
    for (const table of plan.modelTables) {
      modelTableRows[table.table] = Number(
        db
          .query(`DELETE FROM ${quoteIdentifier(table.table)} WHERE game_id IN (${targetPlaceholders})`)
          .run(...gameIds).changes,
      );
    }

    return {
      modelTableRows,
      entityRelations: deleteRelations(db, "entity_model", plan.entityRelations),
      eventRelations: deleteRelations(db, "event_model", plan.eventRelations),
      historicalEntityRows: deleteHistoricalRows(db, "entities_historical", modelIds, plan.targetKeyPrefixes),
      historicalEventMessageRows: deleteHistoricalRows(
        db,
        "event_messages_historical",
        modelIds,
        plan.targetKeyPrefixes,
      ),
      entities: deleteByIds(db, "entities", plan.orphanEntityIds),
      eventMessages: deleteByIds(db, "event_messages", plan.orphanEventMessageIds),
    };
  })();
}

function vacuumDatabase(db: Database): void {
  db.run("VACUUM");
  db.query("PRAGMA wal_checkpoint(TRUNCATE)").get();
}

export function runGamePrune(options: GamePruneOptions): object {
  const plan = planGamePrune(options.dbPath, options.selection);
  if (!options.execute) {
    return { kind: "torii-s2-game-prune", status: "DRY_RUN", plan };
  }
  if (!options.confirmOffline) {
    throw new Error("Refusing to mutate Torii data without confirmOffline; stop Torii and pass --confirm-offline");
  }

  const db = new Database(plan.dbPath, { strict: true });
  try {
    const deleted = executePlan(db, plan);
    if (options.vacuum) {
      vacuumDatabase(db);
    }
    return {
      kind: "torii-s2-game-prune",
      status: "PRUNED",
      vacuumed: options.vacuum === true,
      targets: plan.targets,
      deleted,
      metricsBefore: plan.metricsBefore,
      metricsAfter: readMetrics(db, plan.dbPath),
    };
  } finally {
    db.close();
  }
}

function parseGameIds(value: string): number[] {
  const gameIds = value.split(",").map((entry) => Number(entry.trim()));
  if (gameIds.length === 0 || gameIds.some((gameId) => !Number.isSafeInteger(gameId) || gameId <= 0)) {
    throw new Error("--game-ids must contain positive integers separated by commas");
  }
  return gameIds;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help === true) {
    console.log(
      "Usage: bun prune-games.ts --db <torii.db> (--game-ids <id,id> | --settled-older-than-days <n>) [--dry-run | --execute --confirm-offline] [--vacuum] [--output <json>]",
    );
    return;
  }

  const gameIdsValue = optionalString(args, "game-ids");
  const settledOlderThanDays = optionalInteger(args, "settled-older-than-days");
  if (gameIdsValue && settledOlderThanDays !== undefined) {
    throw new Error("--game-ids and --settled-older-than-days are mutually exclusive");
  }
  if (!gameIdsValue && settledOlderThanDays === undefined) {
    throw new Error("One of --game-ids or --settled-older-than-days is required");
  }
  if (settledOlderThanDays !== undefined && settledOlderThanDays <= 0) {
    requirePositiveInteger(args, "settled-older-than-days");
  }
  const execute = hasFlag(args, "execute");
  if (execute && hasFlag(args, "dry-run")) {
    throw new Error("--dry-run and --execute are mutually exclusive");
  }
  if (!execute && hasFlag(args, "vacuum")) {
    throw new Error("--vacuum requires --execute");
  }

  const report = runGamePrune({
    dbPath: requireString(args, "db"),
    selection: gameIdsValue ? { gameIds: parseGameIds(gameIdsValue) } : { settledOlderThanDays },
    execute,
    confirmOffline: hasFlag(args, "confirm-offline"),
    vacuum: hasFlag(args, "vacuum"),
  });
  await writeJsonReport(report, optionalString(args, "output"));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
