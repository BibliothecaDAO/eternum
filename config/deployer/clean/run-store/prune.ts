import * as fs from "node:fs";
import * as path from "node:path";
import type { FactoryGameRunMaintenanceIndexEntry, FactoryRunMaintenanceIndexRecord } from "./types";

export interface FactoryRunPruneOptions {
  now: Date;
  maxAgeDays: number;
}

export interface FactoryRunStorePruneEnvironmentResult {
  environment: string;
  indexPath: string;
  prunedGameNames: string[];
  remainingEntryCount: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A game run entry is prunable when the game is definitively over and no
 * automation could still act on it: status complete, no running step, no
 * unexpired launch lease, and the record has been untouched for longer than
 * `maxAgeDays`.
 *
 * GET /api/factory/runs makes one GitHub subrequest per indexed run, and the
 * Cloudflare Workers free plan caps a single invocation at 50 subrequests, so
 * environments must stay well below ~47 indexed runs for the launch dashboard
 * to load. Pruning settled runs keeps each environment under that budget.
 */
export function isPrunableFactoryGameRunEntry(
  entry: FactoryGameRunMaintenanceIndexEntry,
  options: FactoryRunPruneOptions,
): boolean {
  if (entry.kind !== "game" || entry.status !== "complete" || entry.hasRunningStep) {
    return false;
  }

  if (entry.activeLeaseExpiresAt) {
    const leaseExpiry = Date.parse(entry.activeLeaseExpiresAt);
    if (!Number.isFinite(leaseExpiry) || leaseExpiry > options.now.getTime()) {
      return false;
    }
  }

  const updatedAt = Date.parse(entry.updatedAt || "");
  if (!Number.isFinite(updatedAt)) {
    return false;
  }

  return options.now.getTime() - updatedAt > options.maxAgeDays * MS_PER_DAY;
}

export function resolvePrunableFactoryGameRunKeys(
  index: FactoryRunMaintenanceIndexRecord,
  options: FactoryRunPruneOptions,
): string[] {
  return Object.keys(index.entries || {})
    .filter((key) => {
      const entry = index.entries[key];
      return entry.kind === "game" && isPrunableFactoryGameRunEntry(entry, options);
    })
    .sort();
}

function listGameMaintenanceIndexPaths(storeRoot: string): string[] {
  const indexesRoot = path.join(storeRoot, "indexes");
  if (!fs.existsSync(indexesRoot)) {
    return [];
  }

  const indexPaths: string[] = [];
  for (const chain of fs.readdirSync(indexesRoot)) {
    const chainDir = path.join(indexesRoot, chain);
    if (!fs.statSync(chainDir).isDirectory()) continue;
    for (const gameType of fs.readdirSync(chainDir)) {
      const candidate = path.join(chainDir, gameType, "games.json");
      if (fs.existsSync(candidate)) {
        indexPaths.push(candidate);
      }
    }
  }
  return indexPaths.sort();
}

/**
 * Prune settled game runs from a checked-out factory-runs working tree:
 * delete each prunable run record file and drop its games.json index entry.
 * Run records stay recoverable from the branch history. With `dryRun`, only
 * report what would be pruned.
 */
export function pruneFactoryRunStoreDirectory(
  storeRoot: string,
  options: FactoryRunPruneOptions & { dryRun?: boolean },
): FactoryRunStorePruneEnvironmentResult[] {
  const results: FactoryRunStorePruneEnvironmentResult[] = [];

  for (const indexPath of listGameMaintenanceIndexPaths(storeRoot)) {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as FactoryRunMaintenanceIndexRecord;
    const prunedGameNames = resolvePrunableFactoryGameRunKeys(index, options);

    if (prunedGameNames.length > 0 && !options.dryRun) {
      for (const gameName of prunedGameNames) {
        const recordPath = index.entries[gameName].path;
        // Only ever delete run records; refuse paths escaping the runs tree.
        if (recordPath && recordPath.startsWith("runs/") && !recordPath.includes("..")) {
          fs.rmSync(path.join(storeRoot, recordPath), { force: true });
        }
        delete index.entries[gameName];
      }
      index.updatedAt = options.now.toISOString();
      fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    }

    results.push({
      environment: index.environment,
      indexPath,
      prunedGameNames,
      remainingEntryCount: Object.keys(index.entries).length - (options.dryRun ? prunedGameNames.length : 0),
    });
  }

  return results;
}
