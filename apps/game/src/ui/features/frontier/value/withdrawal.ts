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

/** A withdrawal the shard applied: its whole LORDS, and the transaction there that is its claim on the ledger. */
export type SentWithdrawal = { amount: number; claimId: string; fromBlock: number };

/**
 * What the game made of a withdrawal: applied (the LORDS left the realm, and the ledger now pays its claim), not
 * applied with the reason (refused by the game, or never sent), or unknown: no answer, so it may still apply.
 */
export type WithdrawalOutcome =
  | ({ kind: "applied" } & SentWithdrawal)
  | { kind: "not-applied"; reason: string }
  | { kind: "unknown"; amount: number };

/**
 * Where a withdrawal stands: being sent to the shard and applied, then on its way to the wallet, held while payouts are
 * paused, or paid on Starknet with the transaction that paid it. A withdrawal the game did not apply returns to the
 * amount's choice with the reason; one with no answer says so and offers no second send.
 */
export const withdrawStepOf = ({
  sending,
  outcome,
  paidIn,
  paused,
}: {
  /** The amount on its way to the shard, until the game's outcome. */
  sending: number | null;
  outcome: WithdrawalOutcome | null;
  /** The Starknet transaction's address on the explorer, once the ledger paid the claim. */
  paidIn: string | undefined;
  paused: boolean | undefined;
}): WithdrawStep => {
  if (sending !== null) return { kind: "sending", amount: sending };
  if (!outcome) return { kind: "pick" };
  if (outcome.kind === "not-applied") return { kind: "pick", notApplied: outcome.reason };
  if (outcome.kind === "unknown") return { kind: "unknown", amount: outcome.amount };
  if (paidIn) return { kind: "paid", amount: outcome.amount, transactionUrl: paidIn };
  return paused ? { kind: "waiting", amount: outcome.amount } : { kind: "sending", amount: outcome.amount };
};
