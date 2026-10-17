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
    const told = new Set(shown.map((event) => sendKey(event.tx_hash)));
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
  row.kind === "transaction" && row.transaction.status === "success" && told.has(sendKey(row.transaction.hash));

/** A battle or raid, anyone's unless the filter asks for the player's; a realm's news only when it is the player's. */
const isEventsStory = (event: ProcessedStoryEvent, filter: ImportantFeedFilter, address: string | null): boolean => {
  if (includesStoryNotification("important", event.story)) return filter !== "mine" || involvesPlayer(event, address);
  return filter !== "combat" && includesStoryNotification("standard", event.story) && involvesPlayer(event, address);
};

/** Every feed row shows the wall-clock time it happened. */
export const formatFeedTime = (atMs: number): string =>
  new Date(atMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * What a quick-feed row is to the player: one action, whichever row tells it. A story of a send this client made is
 * that send told better, so it shares the send's key and takes over its place and its time on screen.
 */
export const quickFeedKey = (row: ImportantFeedRow, sends: ReadonlySet<string>): string => {
  if (row.kind === "transaction") return sendKey(row.transaction.hash);
  if (row.kind === "story" && sends.has(sendKey(row.event.tx_hash))) return sendKey(row.event.tx_hash);
  return row.id;
};

/** A send's key, the same however its hash is written (case, leading zeros). */
export const sendKey = (hash: string): string => `send:${hash.toLowerCase().replace(/^0x0*/, "")}`;

/** The quick feed's screen: the keys drawn, top first, and the keys whose fade has ended. */
export interface QuickFeedScreen {
  shown: readonly string[];
  ended: ReadonlySet<string>;
}

/**
 * The quick feed, one rule: a row stays on screen 20 s from when it is first drawn, its fade being its clock. So a
 * drawn row keeps its slot and its place until its fade ends: no newer row pushes it off, and no re-sort moves it,
 * which would restart its fade. New rows come in on top, newest first, only into free slots and only while their event
 * is within the window of now (the chain clock their stamps are on). Returns the rows to draw by key, top first.
 */
export function selectQuickFeedRows(
  rows: ImportantFeedRow[],
  nowMs: number,
  screen: QuickFeedScreen,
  sends: ReadonlySet<string>,
  windowMs: number,
  maxRows: number,
): Array<{ key: string; row: ImportantFeedRow }> {
  const byKey = new Map<string, ImportantFeedRow>();
  for (const row of rows.toSorted((left, right) => right.at - left.at)) {
    const key = quickFeedKey(row, sends);
    if (!byKey.has(key)) byKey.set(key, row);
  }
  const kept = screen.shown.filter((key) => byKey.has(key) && !screen.ended.has(key));
  const fresh = [...byKey]
    .filter(([key, row]) => !kept.includes(key) && !screen.ended.has(key) && Math.abs(nowMs - row.at) < windowMs)
    .slice(0, Math.max(0, maxRows - kept.length))
    .map(([key]) => key);
  return [...fresh, ...kept].map((key) => ({ key, row: byKey.get(key)! }));
}
