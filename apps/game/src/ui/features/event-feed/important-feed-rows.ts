import type { Headline } from "../news-headlines/headline-types";
import { TransactionType } from "@bibliothecadao/provider";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRow, FeedRows } from "./event-feed-rows";
import type { Transaction } from "@/hooks/store/use-transaction-store";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { includesStoryNotification, logicalStoryIdentity, storyRecipients } from "@bibliothecadao/notifications";
import { captureIdentity } from "../news-headlines/capture-headline";

/**
 * What Events and the Log show, the player's one choice for both: the important events (the default), everything about
 * the player, or everything Events holds.
 */
export type EventsFilter = "important" | "mine" | "all";
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
 * What Events holds, through the player's filter: battles and raids (anyone's), the news of the player's own realms
 * (level-ups, buildings, deliveries received), their caravans, this session's sends and notices, and the game's
 * headlines. Every story comes from the game's history, so it is back after a reload; a send the history has a story
 * for shows as that story, whatever the story's notification level, so a send's row tells its outcome (what an
 * explore found). Routine moves and point accrual remain in the world history.
 */
export function selectImportantFeedRows(
  stories: ProcessedStoryEvent[],
  feed: FeedRows,
  filter: EventsFilter,
  address: string | null,
  headlines: Headline[] = [],
): ImportantFeedRow[] {
  const shown = oneStoryPerAction(
    withSendOutcomes(
      stories.filter((event) => isEventsStory(event, address)),
      stories,
      [...feed.inFlight, ...feed.recent],
    ),
  );
  const rows: ImportantFeedRow[] = shown.map((event) => ({
    kind: "story",
    id: `story:${event.id}`,
    at: event.timestampMs,
    event,
  }));
  const told = new Set(shown.map((event) => sendKey(event.tx_hash)));
  rows.push(
    ...[...feed.inFlight, ...feed.recent].filter((row) => isImportantPersonalRow(row) && !isToldByStory(row, told)),
  );
  rows.push(
    ...headlines.map((headline) => ({ kind: "headline" as const, id: headline.id, at: headline.timestamp, headline })),
  );
  return onePerAction(rows)
    .map(({ row }) => row)
    .filter((row) => matchesEventsFilter(row, filter, address));
}

/** Whether a row shows under the filter: every row under All, the player's own under Mine, the important under Important. */
export const matchesEventsFilter = (row: ImportantFeedRow, filter: EventsFilter, address: string | null): boolean => {
  if (filter === "all") return true;
  return filter === "mine" ? isMine(row, address) : isImportantEvent(row, address);
};

/** A row about the player: a story that names them when it happened, and their own sends and notices. */
const isMine = (row: ImportantFeedRow, address: string | null): boolean =>
  row.kind === "story" ? involvesPlayer(row.event, address) : row.kind !== "headline";

/**
 * The game's milestones: its start, its last five minutes and its end, a Hyperstructure taken (by anyone: the race for
 * points), a realm fallen and a player eliminated. A tier-three building is news, not a milestone.
 */
const MILESTONES = new Set<Headline["type"]>([
  "game-start",
  "five-min-warning",
  "game-end",
  "hyper-capture",
  "realm-fall",
  "elimination",
]);

/** The stories that are important when they name the player: a fight, a raid, a capture, a crate opened. */
const IMPORTANT_STORIES = new Set(["BattleEvent", "RaidEvent", "StructureCapturedStory", "RelicChestOpened"]);

/**
 * Whether a row is important, the default view of Events and the Log: what the player must not miss. Their fights (an
 * army lost, a realm under attack), raids and captures, by them or of theirs, the crates they opened, the game's
 * milestones, and an order of theirs refused or not yet settled, or a warning.
 */
const isImportantEvent = (row: ImportantFeedRow, address: string | null): boolean => {
  switch (row.kind) {
    case "headline":
      return MILESTONES.has(row.headline.type);
    case "story":
      return IMPORTANT_STORIES.has(row.event.story) && involvesPlayer(row.event, address);
    case "transaction":
      return needsThePlayersEye.has(row.transaction.status);
    case "notice":
      return row.notice.kind === "error" || row.notice.kind === "warning";
  }
};

/** A completed send whose story history holds: the story shows instead. */
/**
 * The Events stories, and for each of this session's shown, done sends that none of them tells, the stories that send
 * wrote, whatever their level: what an explore found is its row's outcome. A routine send stays out, stories and all.
 */
const withSendOutcomes = (
  told: ProcessedStoryEvent[],
  stories: ProcessedStoryEvent[],
  sends: FeedRow[],
): ProcessedStoryEvent[] => {
  const toldKeys = new Set(told.map((event) => sendKey(event.tx_hash)));
  const shownSends = new Set(
    sends.flatMap((row) =>
      row.kind === "transaction" && row.transaction.status === "success" && isImportantPersonalRow(row)
        ? [sendKey(row.transaction.hash)]
        : [],
    ),
  );
  const outcomes = stories.filter((event) => {
    const key = sendKey(event.tx_hash);
    return shownSends.has(key) && !toldKeys.has(key);
  });
  return [...told, ...outcomes];
};

const isToldByStory = (row: FeedRow, told: Set<string>): boolean =>
  row.kind === "transaction" && row.transaction.status === "success" && told.has(sendKey(row.transaction.hash));

/** A battle, raid or capture, anyone's; a realm's news only when it is the player's. */
const isEventsStory = (event: ProcessedStoryEvent, address: string | null): boolean =>
  includesStoryNotification("important", event.story) ||
  (includesStoryNotification("standard", event.story) && involvesPlayer(event, address));

/**
 * A capture story's own identity, which its headline carries too; null for any other row, and for a capture story that
 * does not name its structure and both owners, which then tells its action on its own.
 */
const captureOf = (row: ImportantFeedRow): string | null => {
  if (row.kind !== "story" || row.event.story !== "StructureCapturedStory") return null;
  const { previous_owner: previousOwner, new_owner: newOwner } = row.event.storyPayload;
  if (row.event.entity_id === null || row.event.entity_id === undefined || previousOwner == null || newOwner == null) {
    return null;
  }
  return captureIdentity(row.event.entity_id, previousOwner, newOwner);
};

/** Each capture told by a story, by the key of the transaction that wrote it, for the headline that tells it too. */
const captureAliases = (rows: readonly ImportantFeedRow[]): Map<string, string> =>
  new Map(
    rows.flatMap((row) => {
      const capture = captureOf(row);
      return capture && row.kind === "story" ? [[capture, sendKey(row.event.tx_hash)] as const] : [];
    }),
  );

/**
 * What a row is to the player: one action, whichever row tells it. A send and every story its transaction wrote share
 * the transaction's key; a capture's headline shares its capture story's, or the capture's own until the story arrives;
 * any other row is its own.
 */
const actionKey = (row: ImportantFeedRow, aliases: Map<string, string>): string => {
  if (row.kind === "transaction") return sendKey(row.transaction.hash);
  if (row.kind === "story") return sendKey(row.event.tx_hash);
  if (row.kind === "headline" && row.headline.action) return aliases.get(row.headline.action) ?? row.headline.action;
  return row.id;
};

/**
 * Which row tells an action: a capture first (the outcome of the fight that won it, wherever the chain wrote it among
 * the transaction's stories, and fuller than its headline), then any other story or send, then a headline.
 */
const tellingRank = (row: ImportantFeedRow): number =>
  row.kind === "story" && row.event.story === "StructureCapturedStory" ? 2 : row.kind === "headline" ? 0 : 1;

/** A send's key, the same however its hash is written (case, leading zeros). */
export const sendKey = (hash: string): string => `send:${hash.toLowerCase().replace(/^0x0*/, "")}`;

/** A row Events shows: its action's key and the action's latest words. */
export interface ShownRow {
  key: string;
  row: ImportantFeedRow;
}

/** Each action once, newest first, told by its best row. */
const onePerAction = (rows: ImportantFeedRow[]): ShownRow[] => {
  const aliases = captureAliases(rows);
  const latest = new Map<string, ImportantFeedRow>();
  for (const row of rows.toSorted((left, right) => right.at - left.at)) {
    const key = actionKey(row, aliases);
    const held = latest.get(key);
    if (!held || tellingRank(row) > tellingRank(held)) latest.set(key, row);
  }
  return [...latest].map(([key, row]) => ({ key, row })).toSorted((left, right) => right.row.at - left.row.at);
};

/**
 * The Events strip, one rule: the last `count` actions the filter admits, newest on top, which stay until newer ones it
 * admits replace them. `remembered` is what the strip showed: a row its sources still hold takes its latest words (and
 * leaves if they no longer match, a send that settled); one they have dropped, past their bounds, stays as it was, so
 * what the filter leaves out never pushes what it admits off the strip. The memory is the strip itself, `count` rows.
 */
export const nextStripRows = (
  remembered: readonly ShownRow[],
  rows: ImportantFeedRow[],
  matches: (row: ImportantFeedRow) => boolean,
  count: number,
): ShownRow[] => {
  const current = onePerAction(rows);
  const aliases = captureAliases(rows);
  const now = new Map(current.map(({ key, row }) => [key, row]));
  const kept = new Map<string, ImportantFeedRow>();
  for (const { row } of remembered) {
    const key = actionKey(row, aliases);
    const latest = now.get(key);
    if (!latest) kept.set(key, row);
    else if (matches(latest)) kept.set(key, latest);
  }
  for (const { key, row } of current) if (!kept.has(key) && matches(row)) kept.set(key, row);
  return [...kept]
    .map(([key, row]) => ({ key, row }))
    .toSorted((left, right) => right.row.at - left.row.at)
    .slice(0, count);
};
