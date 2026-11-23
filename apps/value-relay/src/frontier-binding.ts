import { ledgerInteger, rpcAt, readFrontierFunding, type FrontierFundingTerms } from "@realms-world/value-ledger";
import { ShardReader } from "./shard-rpc";
import { readConfirmedSnapshot, optionalRow, singleRow, type ConfirmedSnapshot } from "./shard-snapshot";
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
  frontierSeason: (gameId: number, confirmedAt: number, prizeRank: number) =>
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
      if (pool !== BigInt(funding.pool) / 10n ** 18n) throw new Error("frontier_pool_differs_from_ledger");
      if (!Number.isSafeInteger(confirmedAt) || confirmedAt < 0 || (prizeRank > 0 && confirmedAt < funding.end))
        throw new Error("withdrawal_created_outside_claim_window");
      return gameId;
    }),
});

function frontierTerms(snapshot: ConfirmedSnapshot): FrontierFundingTerms {
  const game = singleRow(snapshot, "GameRegistry");
  const chests = singleRow(snapshot, "ChestRules");
  const rules = singleRow(snapshot, "SliceRules");
  return {
    start: ledgerInteger(String(game.start_main_at)),
    end: ledgerInteger(String(game.end_at)),
    seed: String(game.seed),
    dayUnit: ledgerInteger(String(rules.day_unit_seconds)),
    claimWindow: ledgerInteger(String(chests.claim_window_seconds)),
    chestPoolBps: ledgerInteger(String(chests.pool_bps)),
    topN: ledgerInteger(String(chests.top_n)),
  };
}
