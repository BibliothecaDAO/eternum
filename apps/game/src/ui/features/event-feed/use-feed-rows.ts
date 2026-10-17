import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { useMemo } from "react";
import { deriveFeedRows, type FeedRows } from "./event-feed-rows";
import { useEventFeedStore } from "./event-feed-store";

/** The feed rows from their two sources: the client's transactions and its notices. */
export const useFeedRows = (): FeedRows => {
  const transactions = useTransactionStore((state) => state.transactions);
  const notices = useEventFeedStore((state) => state.notices);
  return useMemo(() => deriveFeedRows({ transactions, notices }), [notices, transactions]);
};
