import type { Headline } from "../news-headlines/headline-types";
import { TransactionType } from "@bibliothecadao/provider";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRow, FeedRows } from "./event-feed-rows";
import { includesStoryNotification, logicalStoryIdentity, storyRecipients } from "@bibliothecadao/notifications";

export type ImportantFeedFilter = "all" | "mine" | "combat";
export type ImportantFeedRow =
  | { kind: "headline"; id: string; at: number; headline: Headline }
  | FeedRow
  | { kind: "story"; id: string; at: number; event: ProcessedStoryEvent };

const sameOwner = (left: unknown, right: string | null): boolean => {
  if (left == null || right === null) return false;
  try {
    return BigInt(String(left)) === BigInt(right);
  } catch {
    return false;
  }
};
export const involvesPlayer = (event: ProcessedStoryEvent, address: string | null): boolean =>
  storyRecipients(event.story, event.owner, event.storyPayload).some((owner) => sameOwner(owner, address));

export const battleIdentity = (event: ProcessedStoryEvent): string =>
  logicalStoryIdentity(event.event_id, event.story, event, event.storyPayload);

const routineProductionTypes = new Set<TransactionType>([
  TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
  TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION,
  TransactionType.BURN_RESOURCE_FOR_LABOR_PRODUCTION,
]);

function isImportantPersonalRow(row: FeedRow): boolean {
  if (row.kind !== "transaction") return true;
  return row.isStuck || row.transaction.status === "reverted" || !routineProductionTypes.has(row.transaction.type);
}

/** Battles include structure captures. Routine moves and point accrual remain in the full log. */
export function selectImportantFeedRows(
  stories: ProcessedStoryEvent[],
  feed: FeedRows,
  filter: ImportantFeedFilter,
  address: string | null,
  headlines: Headline[] = [],
): ImportantFeedRow[] {
  const battles = new Set<string>();
  const rows: ImportantFeedRow[] = stories
    .filter(
      (event) =>
        includesStoryNotification("important", event.story) && (filter !== "mine" || involvesPlayer(event, address)),
    )
    .filter((event) => {
      const identity = battleIdentity(event);
      if (battles.has(identity)) return false;
      battles.add(identity);
      return true;
    })
    .map((event) => ({ kind: "story", id: `story:${event.id}`, at: event.timestampMs, event }));
  if (filter !== "combat") {
    rows.push(...[...feed.arrived, ...feed.inFlight, ...feed.recent].filter(isImportantPersonalRow));
  }
  rows.push(
    ...headlines.map((headline) => ({ kind: "headline" as const, id: headline.id, at: headline.timestamp, headline })),
  );
  return rows.sort((left, right) => right.at - left.at);
}

/** Every feed row shows the wall-clock time it happened. */
export const formatFeedTime = (atMs: number): string =>
  new Date(atMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/** The quick feed shows what just happened: rows inside the window, newest first, capped. */
export function selectQuickFeedRows(
  rows: ImportantFeedRow[],
  nowMs: number,
  windowMs: number,
  maxRows: number,
): ImportantFeedRow[] {
  return rows
    .filter((row) => nowMs >= row.at && nowMs - row.at < windowMs)
    .sort((left, right) => right.at - left.at)
    .slice(0, maxRows);
}
