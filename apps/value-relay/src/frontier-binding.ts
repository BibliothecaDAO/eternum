import { rpcAt, readFrontierFunding } from "@realms-world/value-ledger";
import { ShardReader } from "./shard-rpc";
import { readConfirmedSnapshot, optionalRow } from "./shard-snapshot";
import { frontierTerms } from "./frontier-games";
import { uint } from "./shard-rpc";
import { relayOperation } from "./ports";

type Ledger = { rpcUrl: string; address: string };

/** Frontier funding uses the shard game id as its season id. */
export const frontierReceiptBindings = (
  reader: ShardReader,
  ledgerOf: () => Ledger,
  identity: { realmsIdForAccount(account: string): Promise<string | null> },
  heraldUrl: string,
) => ({
  realmsIdForAccount: (account: string) => identity.realmsIdForAccount(account),
  frontierSeason: (gameId: number, confirmedAt: number) =>
    relayOperation("resolve_frontier_funding", async () => {
      const snapshot = await readConfirmedSnapshot(reader.connection, heraldUrl, gameId, [
        "GameRegistry",
        "ChestRules",
        "SliceRules",
        "LordsBudget",
      ]);
      const budget = optionalRow(snapshot, "LordsBudget");
      const pool = budget ? uint(String(budget.pool), 128) : 0n;
      if (pool === 0n) throw new Error("frontier_pool_unpublished");
      const ledger = ledgerOf();
      const funding = await readFrontierFunding(
        rpcAt(ledger.rpcUrl),
        ledger.address,
        { chainId: reader.connection.chainId, gameId },
        frontierTerms(snapshot),
      );
      if (pool * 10n ** 18n !== BigInt(funding.pool)) throw new Error("frontier_pool_differs_from_ledger");
      if (!Number.isSafeInteger(confirmedAt) || confirmedAt < 0 || confirmedAt >= funding.claimDeadline)
        throw new Error("withdrawal_created_outside_claim_window");
      return gameId;
    }),
});
