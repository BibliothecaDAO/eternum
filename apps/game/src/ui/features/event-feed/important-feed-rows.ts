import type { Headline } from "../news-headlines/headline-types";
import { TransactionType } from "@bibliothecadao/provider";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRow, FeedRows } from "./event-feed-rows";
import type { Transaction } from "@/hooks/store/use-transaction-store";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { includesStoryNotification, logicalStoryIdentity, storyRecipients } from "@bibliothecadao/notifications";

export type ImportantFeedFilter = "all" | "mine" | "combat";
export type ImportantFeedRow =
  | { kind: "headline"; id: string; at: number; headline: Headline }
  | FeedRow
  | { kind: "story"; id: string; at: number; event: ProcessedStoryEvent };

export const involvesPlayer = (event: ProcessedStoryEvent, address: string | null): boolean =>
  storyRecipients(event.story, event.owner, event.storyPayload).some((owner) => feltEquals(owner, address));

/** One identity per action, however many stories tell it (a battle's two sides, a building placed and paid for). */
export const storyActionIdentity = (event: ProcessedStoryEvent): string =>
  logicalStoryIdentity(event.event_id, event.story, event, event.storyPayload);

/** Each action once, at its first (newest) story: a list of stories never tells one action twice. */
export const oneStoryPerAction = (stories: ProcessedStoryEvent[]): ProcessedStoryEvent[] => {
  const seen = new Set<string>();
  return stories.filter((event) => {
    const identity = storyActionIdentity(event);
    return !seen.has(identity) && seen.add(identity) !== undefined;
  });
};

const routineProductionTypes = new Set<TransactionType>([
  TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
  TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION,
]);

/** Even a routine action shows while its outcome is unsettled or did not go the player's way. */
const needsThePlayersEye = new Set<Transaction["status"]>(["checking", "reverted", "not_sent", "no_answer"]);

function isImportantPersonalRow(row: FeedRow): boolean {
  if (row.kind !== "transaction") return true;
  return needsThePlayersEye.has(row.transaction.status) || !routineProductionTypes.has(row.transaction.type);
}

/**
 * What Events holds: battles and raids (anyone's, or only the player's under Mine), the news of the player's own
 * realms (level-ups, buildings, deliveries received), their caravans, and this session's sends and notices. Every
 * story comes from the game's history, so it is back after a reload; a send the history has a story for shows as
 * that story. Routine moves and point accrual remain in the world history.
 */
export function selectImportantFeedRows(
  stories: ProcessedStoryEvent[],
  feed: FeedRows,
  filter: ImportantFeedFilter,
  address: string | null,
  headlines: Headline[] = [],
): ImportantFeedRow[] {
  const shown = oneStoryPerAction(stories.filter((event) => isEventsStory(event, filter, address)));
  const rows: ImportantFeedRow[] = shown.map((event) => ({
    kind: "story",
    id: `story:${event.id}`,
    at: event.timestampMs,
    event,
  }));
  if (filter !== "combat") {
    const told = new Set(shown.map((event) => event.tx_hash));
    rows.push(
      ...[...feed.arrived, ...feed.inFlight, ...feed.recent].filter(
        (row) => isImportantPersonalRow(row) && !isToldByStory(row, told),
      ),
    );
  }
  rows.push(
    ...headlines.map((headline) => ({ kind: "headline" as const, id: headline.id, at: headline.timestamp, headline })),
  );
  return oneRowPerId(rows.toSorted((left, right) => right.at - left.at));
}

/** Each row once: the same event reached by two sources (a send listed twice, a headline told again) is one row. */
const oneRowPerId = (rows: ImportantFeedRow[]): ImportantFeedRow[] => {
  const seen = new Set<string>();
  return rows.filter((row) => !seen.has(row.id) && seen.add(row.id) !== undefined);
};

/** A completed send whose story history holds: the story shows instead. */
const isToldByStory = (row: FeedRow, told: Set<string>): boolean =>
  row.kind === "transaction" && row.transaction.status === "success" && told.has(row.transaction.hash);

/** A battle or raid, anyone's unless the filter asks for the player's; a realm's news only when it is the player's. */
const isEventsStory = (event: ProcessedStoryEvent, filter: ImportantFeedFilter, address: string | null): boolean => {
  if (includesStoryNotification("important", event.story)) return filter !== "mine" || involvesPlayer(event, address);
  return filter !== "combat" && includesStoryNotification("standard", event.story) && involvesPlayer(event, address);
};

/** Every feed row shows the wall-clock time it happened. */
export const formatFeedTime = (atMs: number): string =>
  new Date(atMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * The quick feed shows what just happened, newest first, capped. A row on screen stays until its own fade ends
 * (`ended`), whatever the chain clock does meanwhile; a row not on screen comes in only while its event is within the
 * window of now, on the chain clock its stamp is on. A hidden row starts nothing: its time begins when it is drawn.
 */
export function selectQuickFeedRows(
  rows: ImportantFeedRow[],
  nowMs: number,
  screen: { showing: ReadonlySet<string>; ended: ReadonlySet<string> },
  windowMs: number,
  maxRows: number,
): ImportantFeedRow[] {
  return rows
    .filter((row) => !screen.ended.has(row.id) && (screen.showing.has(row.id) || Math.abs(nowMs - row.at) < windowMs))
    .toSorted((left, right) => right.at - left.at)
    .slice(0, maxRows);
}
