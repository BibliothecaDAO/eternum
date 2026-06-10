#!/usr/bin/env bun
import { parseArgs } from "./args";
import { pruneFactoryRunStoreDirectory } from "../run-store/prune";

const DEFAULT_MAX_AGE_DAYS = 7;

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  const storeRoot = args.root;
  if (!storeRoot) {
    throw new Error("--root <factory-runs checkout> is required");
  }

  const maxAgeDays = args["max-age-days"] ? Number.parseFloat(args["max-age-days"]) : DEFAULT_MAX_AGE_DAYS;
  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    throw new Error(`Invalid --max-age-days: ${args["max-age-days"]}`);
  }

  const dryRun = args["dry-run"] === "true";
  const results = pruneFactoryRunStoreDirectory(storeRoot, { now: new Date(), maxAgeDays, dryRun });

  let totalPruned = 0;
  for (const result of results) {
    totalPruned += result.prunedGameNames.length;
    const action = dryRun ? "would prune" : "pruned";
    console.log(
      `[prune-run-store] ${result.environment}: ${action} ${result.prunedGameNames.length} run(s), ` +
        `${result.remainingEntryCount} entr(ies) remain`,
    );
    for (const gameName of result.prunedGameNames) {
      console.log(`[prune-run-store]   - ${gameName}`);
    }
  }

  console.log(`[prune-run-store] total: ${dryRun ? "would prune" : "pruned"} ${totalPruned} run(s)`);
}

main();
