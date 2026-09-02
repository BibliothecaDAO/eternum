import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { useMemo } from "react";
import { deriveFeedRows, type FeedRows } from "./event-feed-rows";
import { useEventFeedStore } from "./event-feed-store";

/** The feed rows from their three sources; the block timestamp is the clock the caravan countdowns follow. */
export const useFeedRows = (): FeedRows => {
  const transactions = useTransactionStore((state) => state.transactions);
  const stuckThresholdMs = useTransactionStore((state) => state.stuckThresholdMs);
  const arrivals = useWorldSlicesStore((state) => state.resourceArrivals);
  const notices = useEventFeedStore((state) => state.notices);
  const nowSeconds = useCurrentBlockTimestamp();

  return useMemo(
    () =>
      deriveFeedRows({ transactions, arrivals, notices, nowMs: Date.now(), nowSeconds, stuckThresholdMs }),
    [arrivals, notices, nowSeconds, stuckThresholdMs, transactions],
  );
};
