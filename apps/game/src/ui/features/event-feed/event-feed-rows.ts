import type { Transaction } from "@/hooks/store/use-transaction-store";
import type { Resource, ResourceArrivalInfo } from "@bibliothecadao/types";
import type { FeedNotice } from "./event-feed-store";

export type FeedRow =
  | { kind: "transaction"; id: string; at: number; transaction: Transaction; isStuck: boolean }
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
  /** Pending and stuck transactions, and caravans still on the road — newest first, stuck first. */
  inFlight: FeedRow[];
  /** Caravans that have reached their structure and wait to be claimed. */
  arrived: FeedRow[];
  /** Completed transactions and notices, newest first. */
  recent: FeedRow[];
}

interface DeriveFeedRowsInput {
  transactions: readonly Transaction[];
  arrivals: readonly ResourceArrivalInfo[];
  notices: readonly FeedNotice[];
  nowMs: number;
  nowSeconds: number;
  stuckThresholdMs: number;
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
 * the arrival reaches RECS; the caravan row flips to arrived when its time passes.
 */
export const deriveFeedRows = ({
  transactions,
  arrivals,
  notices,
  nowMs,
  nowSeconds,
  stuckThresholdMs,
  maxRecent = 15,
}: DeriveFeedRowsInput): FeedRows => {
  const inFlight: FeedRow[] = [];
  const arrived: FeedRow[] = [];
  const recent: FeedRow[] = [];

  for (const transaction of transactions) {
    if (transaction.status === "pending") {
      const isStuck = nowMs - transaction.submittedAt >= stuckThresholdMs;
      inFlight.push({ kind: "transaction", id: transaction.hash, at: transaction.submittedAt, transaction, isStuck });
    } else {
      recent.push({
        kind: "transaction",
        id: transaction.hash,
        at: transaction.confirmedAt ?? transaction.submittedAt,
        transaction,
        isStuck: false,
      });
    }
  }

  for (const arrival of arrivals) {
    const row = arrivalRow(arrival, nowSeconds);
    (row.remainingSeconds > 0 ? inFlight : arrived).push(row);
  }

  for (const notice of notices) {
    recent.push({ kind: "notice", id: notice.id, at: notice.at, notice });
  }

  inFlight.sort((left, right) => {
    const leftStuck = left.kind === "transaction" && left.isStuck ? 1 : 0;
    const rightStuck = right.kind === "transaction" && right.isStuck ? 1 : 0;
    return rightStuck - leftStuck || byNewest(left, right);
  });
  arrived.sort(byNewest);
  recent.sort(byNewest);

  return { inFlight, arrived, recent: recent.slice(0, maxRecent) };
};

/** What just happened: rows whose moment lies inside the ticker window (notices honour their own ttl). */
export const selectTickerRows = (rows: FeedRows, nowMs: number, windowMs: number): FeedRow[] =>
  [...rows.inFlight, ...rows.arrived, ...rows.recent]
    .filter((row) => (row.kind === "notice" ? nowMs - row.at < row.notice.ttlMs : nowMs - row.at < windowMs))
    .sort(byNewest);
