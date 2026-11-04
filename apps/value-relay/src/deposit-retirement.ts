import { rpcAt, decodeFrontierSeason } from "@realms-world/value-ledger";
import { confirmedDepositBlock } from "@realms-world/value-ledger/deposits";
import { supportsDeposits } from "./deposit-destination";
import { auditDeposits, auditDepositCustody } from "./deposit-conservation";
import { readFrontierGames } from "./frontier-games";
import { readConfirmedSnapshot, optionalRow, singleRow } from "./shard-snapshot";
import { type ShardConnection } from "./shard-rpc";

/** A retirement must retain the source until every receipt resolves and every unused principal receipt is paid on L2. */
export async function checkDepositRetirement(input: {
  shard: ShardConnection & { heraldUrl: string };
  ledger: { rpcUrl: string; address: string; chainId: string };
}) {
  const journal = await auditDepositCustody(input.ledger);
  const directory = await readFrontierGames(input.shard, input.shard.heraldUrl);
  const enabled = await supportsDeposits(input.shard);
  if (!enabled) {
    if (journal?.targets.some((target) => BigInt(target.shard) === BigInt(input.shard.chainId)))
      throw new Error("deposit_root_incompatible");
    return {
      chainId: input.shard.chainId,
      gamesAddress: input.shard.gamesAddress,
      retirementReady: true,
      enabled: false,
    };
  }
  if (!journal) {
    for (const game of directory.games) {
      const snapshot = await readConfirmedSnapshot(input.shard, input.shard.heraldUrl, game.game_id, ["DepositSource"]);
      if (optionalRow(snapshot, "DepositSource")) throw new Error("deposit_ledger_unavailable");
    }
    return {
      chainId: input.shard.chainId,
      gamesAddress: input.shard.gamesAddress,
      retirementReady: true,
      enabled: false,
    };
  }
  const targets = journal.targets.filter((target) => BigInt(target.shard) === BigInt(input.shard.chainId));
  for (const target of targets) {
    const season = decodeFrontierSeason(
      await journal.reader.read("get_frontier", [input.shard.chainId, String(target.gameId)]),
    );
    if (journal.reader.head.time < season.end) throw new Error("deposit_ingress_still_live");
  }
  for (const game of directory.games) {
    const snapshot = await readConfirmedSnapshot(input.shard, input.shard.heraldUrl, game.game_id, [
      "DepositSource",
      "GameRegistry",
    ]);
    if (!optionalRow(snapshot, "DepositSource")) continue;
    const block = await confirmedDepositBlock(rpcAt(input.shard.rpcUrl), undefined, snapshot.confirmed_block);
    if (block.head.time < Number(singleRow(snapshot, "GameRegistry").end_at))
      throw new Error("deposit_season_still_live");
    if (!targets.some((target) => target.gameId === game.game_id)) throw new Error("deposit_target_missing");
    await block.assertCanonical();
  }
  if (targets.some((target) => !directory.games.some((game) => game.game_id === target.gameId)))
    throw new Error("deposit_game_snapshot_pending");
  const payments = journal.payments.filter((payment) => BigInt(payment.shard) === BigInt(input.shard.chainId));
  for (const payment of payments)
    if (payment.status === "pending") throw new Error(`undelivered_deposit:${payment.id}`);
  const observations = await auditDeposits(input.shard, input.shard.heraldUrl, input.ledger, journal);
  if (observations.length !== targets.length) throw new Error("deposit_audit_incomplete");
  for (const game of observations) {
    if (BigInt(game.available) !== 0n || game.unpaidPrincipal !== 0) throw new Error("principal_return_pending");
  }
  await journal.reader.assertCanonical();
  return {
    chainId: input.shard.chainId,
    gamesAddress: input.shard.gamesAddress,
    ledger: input.ledger.address,
    ledgerBlock: journal.reader.head,
    receipts: String(payments.length),
    games: observations,
    retirementReady: true,
  };
}
