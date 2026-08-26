import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  isPrunableFactoryGameRunEntry,
  pruneFactoryRunStoreDirectory,
  resolvePrunableFactoryGameRunKeys,
} from "../run-store/prune";
import type { FactoryGameRunMaintenanceIndexEntry, FactoryRunMaintenanceIndexRecord } from "../run-store/types";

const NOW = new Date("2026-06-10T12:00:00.000Z");
const TEN_DAYS_AGO = "2026-05-31T12:00:00.000Z";
const TWO_DAYS_AGO = "2026-06-08T12:00:00.000Z";

function buildGameEntry(
  gameName: string,
  overrides: Partial<FactoryGameRunMaintenanceIndexEntry> = {},
): FactoryGameRunMaintenanceIndexEntry {
  return {
    kind: "game",
    environment: "appchain.blitz",
    gameName,
    path: `runs/appchain/blitz/${gameName}.json`,
    status: "complete",
    updatedAt: TEN_DAYS_AGO,
    currentStepId: null,
    hasRunningStep: false,
    ...overrides,
  } as FactoryGameRunMaintenanceIndexEntry;
}

function buildIndex(entries: Record<string, FactoryGameRunMaintenanceIndexEntry>): FactoryRunMaintenanceIndexRecord {
  return {
    version: 1,
    environment: "appchain.blitz",
    kind: "game",
    updatedAt: TEN_DAYS_AGO,
    entries,
  } as FactoryRunMaintenanceIndexRecord;
}

describe("isPrunableFactoryGameRunEntry", () => {
  const options = { now: NOW, maxAgeDays: 7 };

  test("prunes a complete run untouched for longer than the age threshold", () => {
    expect(isPrunableFactoryGameRunEntry(buildGameEntry("old-complete"), options)).toBe(true);
  });

  test("keeps recent, non-complete, running, and leased runs", () => {
    expect(isPrunableFactoryGameRunEntry(buildGameEntry("recent", { updatedAt: TWO_DAYS_AGO }), options)).toBe(false);
    expect(isPrunableFactoryGameRunEntry(buildGameEntry("attention", { status: "attention" }), options)).toBe(false);
    expect(isPrunableFactoryGameRunEntry(buildGameEntry("running", { hasRunningStep: true }), options)).toBe(false);
    expect(
      isPrunableFactoryGameRunEntry(
        buildGameEntry("leased", { activeLeaseExpiresAt: "2026-06-11T00:00:00.000Z" }),
        options,
      ),
    ).toBe(false);
  });

  test("keeps runs with an unparseable updatedAt", () => {
    expect(isPrunableFactoryGameRunEntry(buildGameEntry("bad-date", { updatedAt: "not-a-date" }), options)).toBe(false);
  });

  test("prunes once an expired lease has lapsed", () => {
    expect(
      isPrunableFactoryGameRunEntry(buildGameEntry("lease-lapsed", { activeLeaseExpiresAt: TEN_DAYS_AGO }), options),
    ).toBe(true);
  });
});

describe("resolvePrunableFactoryGameRunKeys", () => {
  test("returns only prunable keys, sorted", () => {
    const index = buildIndex({
      "z-old": buildGameEntry("z-old"),
      "a-old": buildGameEntry("a-old"),
      recent: buildGameEntry("recent", { updatedAt: TWO_DAYS_AGO }),
    });

    expect(resolvePrunableFactoryGameRunKeys(index, { now: NOW, maxAgeDays: 7 })).toEqual(["a-old", "z-old"]);
  });
});

describe("pruneFactoryRunStoreDirectory", () => {
  let storeRoot: string;

  afterEach(() => {
    if (storeRoot) {
      fs.rmSync(storeRoot, { recursive: true, force: true });
    }
  });

  function writeStore(index: FactoryRunMaintenanceIndexRecord): string {
    storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "factory-runs-prune-"));
    fs.mkdirSync(path.join(storeRoot, "indexes/appchain/blitz"), { recursive: true });
    fs.mkdirSync(path.join(storeRoot, "runs/appchain/blitz"), { recursive: true });
    fs.writeFileSync(path.join(storeRoot, "indexes/appchain/blitz/games.json"), `${JSON.stringify(index, null, 2)}\n`);
    for (const entry of Object.values(index.entries)) {
      if (entry.path.startsWith("runs/")) {
        fs.writeFileSync(path.join(storeRoot, entry.path), `${JSON.stringify({ gameName: entry }, null, 2)}\n`);
      }
    }
    return storeRoot;
  }

  test("deletes prunable run records and rewrites the index", () => {
    const root = writeStore(
      buildIndex({
        "old-complete": buildGameEntry("old-complete"),
        recent: buildGameEntry("recent", { updatedAt: TWO_DAYS_AGO }),
      }),
    );

    const results = pruneFactoryRunStoreDirectory(root, { now: NOW, maxAgeDays: 7 });

    expect(results).toHaveLength(1);
    expect(results[0].prunedGameNames).toEqual(["old-complete"]);
    expect(results[0].remainingEntryCount).toBe(1);
    expect(fs.existsSync(path.join(root, "runs/appchain/blitz/old-complete.json"))).toBe(false);
    expect(fs.existsSync(path.join(root, "runs/appchain/blitz/recent.json"))).toBe(true);

    const rewritten = JSON.parse(fs.readFileSync(path.join(root, "indexes/appchain/blitz/games.json"), "utf8"));
    expect(Object.keys(rewritten.entries)).toEqual(["recent"]);
    expect(rewritten.updatedAt).toBe(NOW.toISOString());
  });

  test("dry run reports without touching files", () => {
    const root = writeStore(buildIndex({ "old-complete": buildGameEntry("old-complete") }));

    const results = pruneFactoryRunStoreDirectory(root, { now: NOW, maxAgeDays: 7, dryRun: true });

    expect(results[0].prunedGameNames).toEqual(["old-complete"]);
    expect(results[0].remainingEntryCount).toBe(0);
    expect(fs.existsSync(path.join(root, "runs/appchain/blitz/old-complete.json"))).toBe(true);
    const untouched = JSON.parse(fs.readFileSync(path.join(root, "indexes/appchain/blitz/games.json"), "utf8"));
    expect(Object.keys(untouched.entries)).toEqual(["old-complete"]);
  });

  test("never deletes record paths outside the runs tree", () => {
    const escape = buildGameEntry("escape", { path: "sentinel.txt" });
    const root = writeStore(buildIndex({ escape }));
    fs.writeFileSync(path.join(root, "sentinel.txt"), "do not delete\n");

    const results = pruneFactoryRunStoreDirectory(root, { now: NOW, maxAgeDays: 7 });

    expect(results[0].prunedGameNames).toEqual(["escape"]);
    // The entry is dropped from the index, but the non-runs path is not deleted.
    expect(fs.existsSync(path.join(root, "sentinel.txt"))).toBe(true);
    const rewritten = JSON.parse(fs.readFileSync(path.join(root, "indexes/appchain/blitz/games.json"), "utf8"));
    expect(Object.keys(rewritten.entries)).toEqual([]);
  });
});
