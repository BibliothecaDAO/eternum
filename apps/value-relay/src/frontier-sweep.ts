import { depositStructures, supportsDeposits } from "./deposit-destination";
import { decodeNativeRow } from "../../../packages/core/src/client/native-row";
import { StructureType } from "@bibliothecadao/types";
import { ResourcesIds } from "@bibliothecadao/types";
import {
  rpcAt,
  readFrontierFunding,
  readConfirmedLedgerHead,
  frontierTreasuryAmount,
} from "@realms-world/value-ledger";
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

export interface PrincipalSweep {
  chainId: string;
  gameId: number;
  account: string;
  amount: string;
}
type PayPrincipal = (claim: PrincipalSweep) => Promise<void>;

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
  payPrincipal?: PayPrincipal,
) {
  const directory = await readFrontierGames(target, heraldUrl);
  const reader = new ShardReader(target);
  const now = (await reader.header("latest")).timestamp;
  const operator = new ShardOperator(target);
  let unavailable: unknown;
  for (const game of directory.games) {
    if (game.clock.end_at > now) continue;
    try {
      await sweepGame(
        target,
        heraldUrl,
        ledger,
        game.game_id,
        directory.confirmedBlock,
        reader,
        operator,
        settle,
        payPrincipal,
      );
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
  payPrincipal?: PayPrincipal,
) {
  const snapshot = await settlementSnapshot(target, heraldUrl, gameId, true);
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
  const rewardError = funding.closed ? null : rewardPublicationError(snapshot, funding);
  const principalError = await sweepBalancesAndPayPrincipal(
    target,
    gameId,
    snapshot,
    operator,
    !funding.closed && !rewardError,
    payPrincipal,
  );
  let settlementError: unknown = rewardError;
  if (!funding.closed && !rewardError) {
    try {
      await settleRewards(target.chainId, gameId, snapshot, funding, head.time, settle);
    } catch (error) {
      settlementError = error;
    }
  }
  if (principalError || settlementError) throw principalError ?? settlementError;
}

type RewardFunding = Awaited<ReturnType<typeof readFrontierFunding>>;
function rewardPublicationError(snapshot: ConfirmedSnapshot, funding: RewardFunding): Error | null {
  const budget = optionalRow(snapshot, "LordsBudget");
  const prize = optionalRow(snapshot, "FrontierPrize");
  if (!budget || !prize) return new Error("frontier_pool_unpublished");
  if (
    snapshotUint(budget.pool, 128) !== BigInt(funding.pool) / 10n ** 18n ||
    snapshotUint(prize.pool, 128) !== BigInt(funding.prizePool) / 10n ** 18n
  )
    return new Error("frontier_sweep_funding_differs");
  return null;
}

async function settleRewards(
  chainId: string,
  gameId: number,
  snapshot: ConfirmedSnapshot,
  funding: RewardFunding,
  now: number,
  settle: (settlement: FrontierSettlement) => Promise<void>,
) {
  if (earnedRealms(snapshot).length > 0) return;
  const expired = now >= funding.claimDeadline;
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
  await settle({ chainId, gameId, chestWithdrawn, prizeWithdrawn });
}

function earnedRealms(snapshot: ConfirmedSnapshot): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const { value } of snapshot.models.find(({ model }) => model === "ResourceBalance")!.rows) {
    if (snapshotUint(value.resource_type, 8) !== BigInt(ResourcesIds.Lords)) continue;
    const id = String(snapshotUint(value.entity_id, 64));
    if (seen.has(id)) throw new Error("frontier_sweep_duplicate_balance");
    seen.add(id);
    if (snapshotUint(value.balance, 128) > 0n) ids.push(id);
  }
  return ids.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
}

function fundedRealms(snapshot: ConfirmedSnapshot, earned = true): string[] {
  const ids = earned ? earnedRealms(snapshot) : [];
  const purchased = snapshot.models.find(({ model }) => model === "SpendLords");
  if (purchased?.rows.length) {
    const structures = depositStructures(snapshot);
    for (const { value } of purchased.rows) {
      const balance = decodeNativeRow("SpendLords", value);
      if (balance.available === 0n) continue;
      const realm = structures.find(
        (row) => row.owner === balance.account && row.base.category === StructureType.Realm,
      );
      if (!realm) throw new Error("principal_sweep_realm_missing");
      const id = String(realm.entity_id);
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
}

async function settlementSnapshot(target: ShardConnection, heraldUrl: string, gameId: number, principal = false) {
  const supported = principal && (await supportsDeposits(target));
  return readConfirmedSnapshot(target, heraldUrl, gameId, [
    "GameRegistry",
    "ChestRules",
    "SliceRules",
    "LordsBudget",
    "FrontierPrize",
    "ResourceBalance",
    "LordsWithdrawal",
    ...(supported ? ["SpendLords", "PrincipalWithdrawal", "Structure"] : []),
  ]);
}

async function sweepBalancesAndPayPrincipal(
  target: ShardConnection,
  gameId: number,
  snapshot: ConfirmedSnapshot,
  operator: ShardOperator,
  earned: boolean,
  payPrincipal?: PayPrincipal,
) {
  let unavailable: unknown;
  try {
    for (const structure_id of fundedRealms(snapshot, earned).slice(0, 25)) {
      try {
        await operator.admin("sweep_lords", { game_id: gameId, structure_id });
      } catch (error) {
        unavailable ??= error;
      }
    }
  } catch (error) {
    unavailable ??= error;
  }
  for (const { value } of snapshot.models.find(({ model }) => model === "PrincipalWithdrawal")?.rows ?? []) {
    try {
      const receipt = decodeNativeRow("PrincipalWithdrawal", value);
      if (!payPrincipal) throw new Error("principal_payment_unavailable");
      await payPrincipal({
        chainId: target.chainId,
        gameId,
        account: String(receipt.account),
        amount: String(receipt.amount),
      });
    } catch (error) {
      unavailable ??= error;
    }
  }
  return unavailable;
}

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

/** Independent settlement evidence, including the funding binding and the deadline treasury return. */
export async function frontierSettlementEvidence(
  target: ShardConnection,
  heraldUrl: string,
  report: FrontierSettlement,
  ledger: { rpcUrl: string; address: string },
  treasuryAmount: string,
) {
  const snapshot = await settlementSnapshot(target, heraldUrl, report.gameId);
  const time = (await new ShardReader(target).header(snapshot.confirmed_block)).timestamp;
  const provider = rpcAt(ledger.rpcUrl);
  const head = await readConfirmedLedgerHead(provider);
  const terms = frontierTerms(snapshot);
  const funding = await readFrontierFunding(
    provider,
    ledger.address,
    { chainId: target.chainId, gameId: report.gameId },
    terms,
    head.number,
  );
  const state = settlementState(snapshot);
  const budget = optionalRow(snapshot, "LordsBudget")!;
  if (
    BigInt(treasuryAmount) !== BigInt(frontierTreasuryAmount(funding)) ||
    funding.closed ||
    time < terms.end ||
    head.time < terms.end ||
    snapshotUint(budget.pool, 128) !== BigInt(funding.pool) / 10n ** 18n ||
    state.prizePool !== BigInt(funding.prizePool) / 10n ** 18n ||
    BigInt(report.chestWithdrawn) !== BigInt(funding.paid) ||
    BigInt(report.prizeWithdrawn) !== BigInt(funding.prizePaid) ||
    BigInt(funding.paid) > BigInt(state.chestWithdrawn) ||
    BigInt(funding.prizePaid) > BigInt(state.prizeWithdrawn)
  )
    return "settlement_funding_or_totals_differ";
  if (head.time >= funding.claimDeadline) return null;
  const realms = earnedRealms(snapshot);
  if (
    realms.length === 0 &&
    state.issued === state.prizePool &&
    BigInt(state.chestWithdrawn) === BigInt(report.chestWithdrawn) &&
    BigInt(state.prizeWithdrawn) === BigInt(report.prizeWithdrawn)
  )
    return null;
  return JSON.stringify({
    realms,
    issued: String(state.issued),
    prizePool: String(state.prizePool),
    chestWithdrawn: state.chestWithdrawn,
    prizeWithdrawn: state.prizeWithdrawn,
  });
}
