import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { useMemo } from "react";
import { deriveFeedRows, type FeedRows } from "./event-feed-rows";
import { useEventFeedStore } from "./event-feed-store";

/** The feed rows from their three sources; the block timestamp is the clock the caravan countdowns follow. */
export const useFeedRows = (): FeedRows => {
  const transactions = useTransactionStore((state) => state.transactions);
  const stuckThresholdMs = useTransactionStore((state) => state.stuckThresholdMs);
  const arrivals = useWorldSlicesStore((state) => state.resourceArrivals);
  const structures = useWorldSlicesStore((state) => state.structures);
  const address = useAccountStore((state) => state.account?.address);
  const ownedStructureIds = useMemo(
    () =>
      structures
        .filter((structure) => address && feltEquals(structure.owner, address))
        .map((structure) => Number(structure.entity_id)),
    [structures, address],
  );
  const notices = useEventFeedStore((state) => state.notices);
  const nowSeconds = useCurrentBlockTimestamp();

  return useMemo(
    () =>
      deriveFeedRows({
        transactions,
        ownedStructureIds,
        arrivals,
        notices,
        nowMs: Date.now(),
        nowSeconds,
        stuckThresholdMs,
      }),
    [ownedStructureIds, arrivals, notices, nowSeconds, stuckThresholdMs, transactions],
  );
};
