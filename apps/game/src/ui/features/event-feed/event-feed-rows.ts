import { TransactionType } from "@bibliothecadao/provider";
import { isTransactionInFlight, type Transaction } from "@/hooks/store/use-transaction-store";
import type { Resource, ResourceArrivalInfo } from "@bibliothecadao/types";
import type { FeedNotice } from "./event-feed-store";

export type FeedRow =
  | { kind: "transaction"; id: string; at: number; transaction: Transaction }
  | {
      kind: "arrival";
      id: string;
      at: number;
      structureEntityId: number;
      resources: Resource[];
      arrivesAtSeconds: number;
      remainingSeconds: number;
    }
  | { kind: "notice"; id: string; at: number; notice: FeedNotice };

export interface FeedRows {
  /** Transactions still sending or checking, and caravans still on the road — newest first. */
  inFlight: FeedRow[];
  /** Caravans that have reached their structure and wait to be claimed. */
  arrived: FeedRow[];
  /** Completed transactions and notices, newest first. */
  recent: FeedRow[];
}

interface DeriveFeedRowsInput {
  transactions: readonly Transaction[];
  ownedStructureIds: readonly number[];
  arrivals: readonly ResourceArrivalInfo[];
  notices: readonly FeedNotice[];
  nowSeconds: number;
  maxRecent?: number;
}

const byNewest = (left: FeedRow, right: FeedRow) => right.at - left.at;

const arrivalRow = (arrival: ResourceArrivalInfo, nowSeconds: number): Extract<FeedRow, { kind: "arrival" }> => {
  const arrivesAtSeconds = Number(arrival.arrivesAt);
  return {
    kind: "arrival",
    id: `arrival:${arrival.structureEntityId}:${arrival.day}:${arrival.slot}`,
    at: arrivesAtSeconds * 1000,
    structureEntityId: arrival.structureEntityId,
    resources: arrival.resources,
    arrivesAtSeconds,
    remainingSeconds: Math.max(0, arrivesAtSeconds - nowSeconds),
  };
};

/**
 * The feed is a view: transactions from the transaction store, caravans from the arrivals slice, notices from the
 * feed store. A started transfer is a row the moment its transaction is pending; its caravan is a row the moment
 * the arrival reaches native store; the caravan row flips to arrived when its time passes.
 */
export const deriveFeedRows = ({
  transactions,
  ownedStructureIds,
  arrivals,
  notices,
  nowSeconds,
  maxRecent = 15,
}: DeriveFeedRowsInput): FeedRows => {
  const inFlight: FeedRow[] = [];
  const arrived: FeedRow[] = [];
  const recent: FeedRow[] = [];

  for (const transaction of transactions) {
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

  const owned = new Set(ownedStructureIds);
  for (const arrival of arrivals) {
    if (!owned.has(arrival.structureEntityId)) continue;
    const row = arrivalRow(arrival, nowSeconds);
    (row.remainingSeconds > 0 ? inFlight : arrived).push(row);
  }

  for (const notice of notices) {
    recent.push({ kind: "notice", id: notice.id, at: notice.at, notice });
  }

  inFlight.sort(byNewest);
  arrived.sort(byNewest);
  recent.sort(byNewest);

  return { inFlight, arrived, recent: recent.slice(0, maxRecent) };
};

/** What just happened: rows whose moment lies inside the ticker window (notices honour their own ttl). */
export const selectTickerRows = (rows: FeedRows, nowMs: number, windowMs: number): FeedRow[] =>
  [...rows.inFlight, ...rows.arrived, ...rows.recent]
    .filter(
      (row) =>
        nowMs >= row.at && (row.kind === "notice" ? nowMs - row.at < row.notice.ttlMs : nowMs - row.at < windowMs),
    )
    .sort(byNewest);

/** Transfer language is shared by every Events rendering, including Log. */
export function transferRowLabel(row: FeedRow): string | null {
  if (row.kind === "arrival") return row.remainingSeconds > 0 ? "Caravan sent" : "Caravan arrived";
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
 * done, refused with the game's reason, or not sent (only on proof). A send unsettled for long moves to checking.
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
  }
};
