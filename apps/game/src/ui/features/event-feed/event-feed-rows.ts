import { TransactionType } from "@bibliothecadao/provider";
import { isTransactionInFlight, type Transaction } from "@/hooks/store/use-transaction-store";
import type { FeedNotice } from "./event-feed-store";

export type FeedRow =
  | { kind: "transaction"; id: string; at: number; transaction: Transaction }
  | { kind: "notice"; id: string; at: number; notice: FeedNotice };

export interface FeedRows {
  /** Transactions still sending or checking, newest first. */
  inFlight: FeedRow[];
  /** Completed transactions and notices, newest first. */
  recent: FeedRow[];
}

interface DeriveFeedRowsInput {
  transactions: readonly Transaction[];
  notices: readonly FeedNotice[];
  maxRecent?: number;
}

const byNewest = (left: FeedRow, right: FeedRow) => right.at - left.at;

/**
 * The feed is a view: transactions from the transaction store, notices from the feed store. A started transfer is a
 * row the moment its transaction is pending. A delivery's landing is told by its story (the arrival it unloads), not by
 * the caravan on the road: the send told its departure.
 */
export const deriveFeedRows = ({ transactions, notices, maxRecent = 15 }: DeriveFeedRowsInput): FeedRows => {
  const inFlight: FeedRow[] = [];
  const recent: FeedRow[] = [];

  // One row per transaction: a send the store holds twice (resent under the same hash) is one event.
  const sends = new Map(transactions.map((transaction) => [transaction.hash, transaction]));
  for (const transaction of sends.values()) {
    if (isTransactionInFlight(transaction)) {
      inFlight.push({ kind: "transaction", id: transaction.hash, at: transaction.submittedAt, transaction });
    } else {
      recent.push({
        kind: "transaction",
        id: transaction.hash,
        at: transaction.confirmedAt ?? transaction.submittedAt,
        transaction,
      });
    }
  }

  for (const notice of notices) {
    recent.push({ kind: "notice", id: notice.id, at: notice.at, notice });
  }

  return { inFlight: inFlight.toSorted(byNewest), recent: recent.toSorted(byNewest).slice(0, maxRecent) };
};

/** Transfer language is shared by every Events rendering, including Log. */
export function transferRowLabel(row: FeedRow): string | null {
  if (
    row.kind === "transaction" &&
    row.transaction.type === TransactionType.SEND &&
    row.transaction.status === "success"
  )
    return "Caravan sent";
  return null;
}

/**
 * The one short line an action's row says: sending, checking (the node has not settled it; never "try again"),
 * done, refused with the game's reason, not sent (only on proof), or the client's own words when no answer came. A
 * send unsettled for long moves to checking.
 */
export const transactionStatusLine = (transaction: Transaction): string => {
  switch (transaction.status) {
    case "pending":
      return "Sending";
    case "checking":
      return "Checking";
    case "success":
      return "Done";
    case "reverted":
      return transaction.errorMessage ? `Refused: ${transaction.errorMessage}` : "Refused";
    case "not_sent":
      return "Not sent";
    case "no_answer":
      return transaction.errorMessage ?? "No answer yet";
  }
};
