import { rpcAt, readFrontierFunding, ledgerInteger } from "@realms-world/value-ledger";
import { ShardReader } from "./shard-rpc";
import { readConfirmedSnapshot, singleRow } from "./shard-snapshot";
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
      ]);
      const game = singleRow(snapshot, "GameRegistry");
      const chests = singleRow(snapshot, "ChestRules");
      const rules = singleRow(snapshot, "SliceRules");
      const ledger = ledgerOf();
      const funding = await readFrontierFunding(
        rpcAt(ledger.rpcUrl),
        ledger.address,
        { chainId: reader.connection.chainId, gameId },
        {
          start: ledgerInteger(String(game.start_main_at)),
          end: ledgerInteger(String(game.end_at)),
          seed: String(game.seed),
          pool: String(chests.pool),
          dayUnit: ledgerInteger(String(rules.day_unit_seconds)),
          claimWindow: ledgerInteger(String(chests.claim_window_seconds)),
        },
      );
      if (!Number.isSafeInteger(confirmedAt) || confirmedAt < 0 || confirmedAt >= funding.claimDeadline)
        throw new Error("withdrawal_created_outside_claim_window");
      return gameId;
    }),
});
