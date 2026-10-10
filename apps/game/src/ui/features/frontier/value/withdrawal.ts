import { PAYOUTS_PAUSED, PAYOUTS_UNREADABLE } from "@/ui/design-system/kit/words";

import type { WithdrawStep } from "./withdraw-sheet";

/**
 * Why no LORDS can leave now: the ledger cannot be read (so a payment could not be followed), or its payouts are
 * paused. Null when a withdrawal can be made; a pause not read yet refuses nothing.
 */
export const withdrawalRefusal = ({
  ledgerReadable,
  paused,
}: {
  ledgerReadable: boolean;
  paused: boolean | undefined;
}): string | null => {
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
