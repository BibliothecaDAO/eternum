import { ResourcesIds } from "@bibliothecadao/types";
import { rpcAt, readFrontierFunding, readConfirmedLedgerHead } from "@realms-world/value-ledger";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { frontierTerms, readFrontierGames } from "./frontier-games";
import {
  optionalRow,
  readConfirmedSnapshot,
  withdrawalTotals,
  snapshotUint,
  type ConfirmedSnapshot,
} from "./shard-snapshot";
import { ShardReader, type ShardConnection } from "./shard-rpc";

export interface FrontierSettlement {
  chainId: string;
  gameId: number;
  chestWithdrawn: string;
  prizeWithdrawn: string;
}

/** Every retry starts from confirmed balances; a debit and its receipt are one shard transaction. */
export async function sweepFrontierLords(
  target: ShardTarget & ShardConnection,
  heraldUrl: string,
  ledger: { rpcUrl: string; address: string },
  settle: (settlement: FrontierSettlement) => Promise<void>,
) {
  const directory = await readFrontierGames(target, heraldUrl);
  const reader = new ShardReader(target);
  const now = (await reader.header("latest")).timestamp;
  const operator = new ShardOperator(target);
  let unavailable: unknown;
  for (const game of directory.games) {
    if (game.clock.end_at > now) continue;
    try {
      await sweepGame(target, heraldUrl, ledger, game.game_id, directory.confirmedBlock, reader, operator, settle);
    } catch (error) {
      unavailable ??= error;
    }
  }
  if (unavailable) throw unavailable;
}

async function sweepGame(
  target: ShardTarget & ShardConnection,
  heraldUrl: string,
  ledger: { rpcUrl: string; address: string },
  gameId: number,
  directoryBlock: number,
  reader: ShardReader,
  operator: ShardOperator,
  settle: (settlement: FrontierSettlement) => Promise<void>,
) {
  const snapshot = await settlementSnapshot(target, heraldUrl, gameId);
  const terms = frontierTerms(snapshot);
  if (
    snapshot.confirmed_block < directoryBlock ||
    (await reader.header(snapshot.confirmed_block)).timestamp < terms.end
  )
    throw new Error("frontier_sweep_snapshot_before_end");
  const provider = rpcAt(ledger.rpcUrl);
  const head = await readConfirmedLedgerHead(provider);
  const funding = await readFrontierFunding(
    provider,
    ledger.address,
    { chainId: target.chainId, gameId },
    terms,
    head.number,
  );
  if (funding.closed) return;
  const expired = head.time >= funding.claimDeadline;
  const budget = optionalRow(snapshot, "LordsBudget");
  const prize = optionalRow(snapshot, "FrontierPrize");
  if (!budget || !prize) throw new Error("frontier_pool_unpublished");
  if (
    snapshotUint(budget.pool, 128) !== BigInt(funding.pool) / 10n ** 18n ||
    snapshotUint(prize.pool, 128) !== BigInt(funding.prizePool) / 10n ** 18n
  )
    throw new Error("frontier_sweep_funding_differs");

  const realms = fundedRealms(snapshot);
  if (realms.length) {
    // Bound one tick's writes; successful realms disappear from the next confirmed snapshot.
    for (const structure_id of realms.slice(0, 25))
      await operator.admin("sweep_lords", { game_id: gameId, structure_id });
    return;
  }
  const state = settlementState(snapshot);
  if (!expired && state.issued !== state.prizePool) return;
  const { chestWithdrawn, prizeWithdrawn } = state;
  if (BigInt(funding.paid) > BigInt(chestWithdrawn) || BigInt(funding.prizePaid) > BigInt(prizeWithdrawn))
    throw new Error("frontier_paid_exceeds_receipts");
  if (
    !expired &&
    (BigInt(funding.paid) !== BigInt(chestWithdrawn) || BigInt(funding.prizePaid) !== BigInt(prizeWithdrawn))
  )
    return;
  await settle({ chainId: target.chainId, gameId, chestWithdrawn, prizeWithdrawn });
}

function fundedRealms(snapshot: ConfirmedSnapshot): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const { value } of snapshot.models.find((model) => model.model === "ResourceBalance")!.rows) {
    if (snapshotUint(value.resource_type, 8) !== BigInt(ResourcesIds.Lords)) continue;
    const id = String(snapshotUint(value.entity_id, 64));
    if (seen.has(id)) throw new Error("frontier_sweep_duplicate_balance");
    seen.add(id);
    if (snapshotUint(value.balance, 128) > 0n) ids.push(id);
  }
  return ids.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
}

const settlementSnapshot = (target: ShardConnection, heraldUrl: string, gameId: number) =>
  readConfirmedSnapshot(target, heraldUrl, gameId, [
    "GameRegistry",
    "ChestRules",
    "SliceRules",
    "LordsBudget",
    "FrontierPrize",
    "ResourceBalance",
    "LordsWithdrawal",
  ]);

function settlementState(snapshot: ConfirmedSnapshot) {
  const budget = optionalRow(snapshot, "LordsBudget");
  const prize = optionalRow(snapshot, "FrontierPrize");
  if (!budget || !prize) throw new Error("frontier_pool_unpublished");
  const issued = snapshotUint(prize.issued, 128);
  const prizePool = snapshotUint(prize.pool, 128);
  if (issued > prizePool || (prize.count !== null && snapshotUint(prize.count, 16) === 0n && issued !== 0n))
    throw new Error("frontier_sweep_prize_differs");
  const totals = withdrawalTotals(snapshot);
  const netChest = snapshotUint(budget.pool, 128) - snapshotUint(budget.pool_left, 128);
  if (totals.chest !== netChest || totals.prize !== issued) throw new Error("frontier_sweep_receipts_differ");
  return {
    issued,
    prizePool,
    chestWithdrawn: String(totals.chest * 10n ** 18n),
    prizeWithdrawn: String(totals.prize * 10n ** 18n),
  };
}

/** Independent confirmed shard evidence for a proposed early close; no operator assertions are accepted. */
export async function frontierSettlementEvidence(
  target: ShardConnection,
  heraldUrl: string,
  report: FrontierSettlement,
) {
  const snapshot = await settlementSnapshot(target, heraldUrl, report.gameId);
  const time = (await new ShardReader(target).header(snapshot.confirmed_block)).timestamp;
  const end = frontierTerms(snapshot).end;
  const realms = fundedRealms(snapshot);
  const state = settlementState(snapshot);
  if (
    time >= end &&
    realms.length === 0 &&
    state.issued === state.prizePool &&
    BigInt(state.chestWithdrawn) === BigInt(report.chestWithdrawn) &&
    BigInt(state.prizeWithdrawn) === BigInt(report.prizeWithdrawn)
  )
    return null;
  return JSON.stringify({
    ended: time >= end,
    realms,
    issued: String(state.issued),
    prizePool: String(state.prizePool),
    chestWithdrawn: state.chestWithdrawn,
    prizeWithdrawn: state.prizeWithdrawn,
  });
}
