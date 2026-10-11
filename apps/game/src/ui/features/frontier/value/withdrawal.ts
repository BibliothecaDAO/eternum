import { PAYOUTS_PAUSED, PAYOUTS_UNREADABLE, WITHDRAWALS_CLOSED } from "@/ui/design-system/kit/words";
import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";

import type { WithdrawStep } from "./withdraw-sheet";

/**
 * The second a season's withdrawals close: the shard stops debits one report grace before the claim window ends, so
 * every withdrawal already made reaches the ledger while it still takes reports (relics.cairo, assert_claim_window).
 */
export const withdrawalsCloseAt = (seasonEnd: number, claimWindowSeconds: number): number =>
  seasonEnd + claimWindowSeconds - nativeRuleConstants.FRONTIER_REPORT_GRACE_SECONDS;

/**
 * Why no LORDS can leave now, the most final reason first: the season's withdrawals have closed, the ledger cannot be
 * read (so a payment could not be followed), or its payouts are paused. Null when a withdrawal can be made; undefined
 * facts refuse nothing yet.
 */
export const withdrawalRefusal = ({
  closesAt,
  now,
  ledgerReadable,
  paused,
}: {
  closesAt: number | undefined;
  now: number;
  ledgerReadable: boolean;
  paused: boolean | undefined;
}): string | null => {
  if (closesAt !== undefined && now >= closesAt) return WITHDRAWALS_CLOSED;
  if (!ledgerReadable) return PAYOUTS_UNREADABLE;
  return paused ? PAYOUTS_PAUSED : null;
};

/** A withdrawal the shard took: its whole LORDS, and the transaction there that is its claim on the ledger. */
export type SentWithdrawal = { amount: number; claimId: string; fromBlock: number };

/**
 * Where a withdrawal stands: being sent to the shard, sent and on its way (the LORDS have left the game's count), held
 * while payouts are paused, or paid on Starknet with the transaction that paid it.
 */
export const withdrawStepOf = ({
  sending,
  sent,
  paidIn,
  paused,
}: {
  /** The amount on its way to the shard, before the shard answers. */
  sending: number | null;
  sent: SentWithdrawal | null;
  /** The Starknet transaction's address on the explorer, once the ledger paid the claim. */
  paidIn: string | undefined;
  paused: boolean | undefined;
}): WithdrawStep => {
  if (sending !== null) return { kind: "sending", amount: sending };
  if (!sent) return { kind: "pick" };
  if (paidIn) return { kind: "paid", amount: sent.amount, transactionUrl: paidIn };
  return paused ? { kind: "waiting", amount: sent.amount } : { kind: "sending", amount: sent.amount };
};
