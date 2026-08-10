import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { planGamePrune, runGamePrune } from "../../../../deploy/appchain/torii-s2/prune-games";

const temporaryDirectories: string[] = [];
const GAME_ONE_KEY = `0x${"1".padStart(64, "0")}/`;
const GAME_TWO_KEY = `0x${"2".padStart(64, "0")}/`;

function createFixture(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "torii-s2-prune-"));
  temporaryDirectories.push(directory);
  const dbPath = path.join(directory, "torii.db");
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE models (id TEXT PRIMARY KEY, namespace TEXT, name TEXT);
    CREATE TABLE entities (id TEXT PRIMARY KEY, keys TEXT);
    CREATE TABLE entity_model (entity_id TEXT, model_id TEXT, UNIQUE(entity_id, model_id));
    CREATE TABLE event_messages (id TEXT PRIMARY KEY, keys TEXT);
    CREATE TABLE event_model (entity_id TEXT, model_id TEXT, UNIQUE(entity_id, model_id));
    CREATE TABLE entities_historical (id TEXT, keys TEXT, model_id TEXT);
    CREATE TABLE event_messages_historical (id TEXT, keys TEXT, model_id TEXT);
    CREATE TABLE "s2-GameRegistry" (
      internal_entity_id TEXT,
      internal_event_message_id TEXT,
      game_id INTEGER,
      status TEXT,
      end_at TEXT
    );
    CREATE TABLE "s2-Preset" (internal_entity_id TEXT, preset_id INTEGER);
    CREATE TABLE "s2-TileOpt" (
      internal_entity_id TEXT,
      internal_event_message_id TEXT,
      game_id INTEGER,
      col INTEGER
    );
    CREATE TABLE "s2-GameCreated" (
      internal_entity_id TEXT,
      internal_event_message_id TEXT,
      game_id INTEGER
    );

    INSERT INTO models VALUES
      ('m-game', 's2', 'GameRegistry'),
      ('m-preset', 's2', 'Preset'),
      ('m-tile', 's2', 'TileOpt'),
      ('m-event', 's2', 'GameCreated');
    INSERT INTO entities VALUES
      ('shared-one', '${GAME_ONE_KEY}'),
      ('tile-one', '${GAME_ONE_KEY}0x0/'),
      ('game-two', '${GAME_TWO_KEY}');
    INSERT INTO entity_model VALUES
      ('shared-one', 'm-game'),
      ('shared-one', 'm-preset'),
      ('tile-one', 'm-tile'),
      ('game-two', 'm-game');
    INSERT INTO event_messages VALUES ('event-one', '${GAME_ONE_KEY}0x1/');
    INSERT INTO event_model VALUES ('event-one', 'm-event');
    INSERT INTO entities_historical VALUES ('tile-one', '${GAME_ONE_KEY}0x0/', 'm-tile');
    INSERT INTO event_messages_historical VALUES ('event-one', '${GAME_ONE_KEY}0x1/', 'm-event');
    INSERT INTO "s2-GameRegistry" VALUES
      ('shared-one', NULL, 1, 'Settled', '0x64'),
      ('game-two', NULL, 2, 'Live', '0xc8');
    INSERT INTO "s2-Preset" VALUES ('shared-one', 1);
    INSERT INTO "s2-TileOpt" VALUES ('tile-one', NULL, 1, 5);
    INSERT INTO "s2-GameCreated" VALUES (NULL, 'event-one', 1);
  `);
  db.close();
  return dbPath;
}

function count(db: Database, table: string): number {
  return Number((db.query(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("settled game pruning", () => {
  test("plans every game-scoped table and preserves a shared preset entity", () => {
    const plan = planGamePrune(createFixture(), { gameIds: [1] });

    expect(plan.targets).toEqual([{ gameId: 1, status: "Settled", endAt: 100 }]);
    expect(plan.modelTables.filter((table) => table.rows > 0).map((table) => table.table)).toEqual([
      "s2-GameCreated",
      "s2-GameRegistry",
      "s2-TileOpt",
    ]);
    expect(plan.orphanEntityIds).toEqual(["tile-one"]);
    expect(plan.orphanEventMessageIds).toEqual(["event-one"]);
    expect(plan.entityRelations).toContainEqual({ entityId: "shared-one", modelId: "m-game" });
    expect(plan.historicalEntityRows).toBe(1);
    expect(plan.historicalEventMessageRows).toBe(1);
  });

  test("requires an offline confirmation before mutation", () => {
    const dbPath = createFixture();
    expect(() => runGamePrune({ dbPath, selection: { gameIds: [1] }, execute: true })).toThrow(
      "stop Torii and pass --confirm-offline",
    );

    const db = new Database(dbPath);
    expect(count(db, '"s2-GameRegistry"')).toBe(2);
    db.close();
  });

  test("selects settled games by end-time age", () => {
    const plan = planGamePrune(createFixture(), {
      settledOlderThanDays: 1,
      nowSeconds: 86_500,
    });

    expect(plan.targets).toEqual([{ gameId: 1, status: "Settled", endAt: 100 }]);
  });

  test("removes exact game relations while retaining global and live rows", () => {
    const dbPath = createFixture();
    const report = runGamePrune({
      dbPath,
      selection: { gameIds: [1] },
      execute: true,
      confirmOffline: true,
      vacuum: true,
    }) as { status: string };

    expect(report.status).toBe("PRUNED");
    const db = new Database(dbPath);
    expect(count(db, '"s2-GameRegistry"')).toBe(1);
    expect(count(db, '"s2-TileOpt"')).toBe(0);
    expect(count(db, '"s2-GameCreated"')).toBe(0);
    expect(count(db, '"s2-Preset"')).toBe(1);
    expect(count(db, "entities")).toBe(2);
    expect(count(db, "event_messages")).toBe(0);
    expect(count(db, "entities_historical")).toBe(0);
    expect(count(db, "event_messages_historical")).toBe(0);
    expect(db.query("SELECT model_id FROM entity_model WHERE entity_id = 'shared-one'").all()).toEqual([
      { model_id: "m-preset" },
    ]);
    db.close();
  });

  test("refuses a live target", () => {
    expect(() => planGamePrune(createFixture(), { gameIds: [2] })).toThrow("status is Live, not Settled");
  });
});
