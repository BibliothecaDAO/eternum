import type { Headline } from "../news-headlines/headline-types";
import { TransactionType } from "@bibliothecadao/provider";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRow, FeedRows } from "./event-feed-rows";
import type { Transaction } from "@/hooks/store/use-transaction-store";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { includesStoryNotification, logicalStoryIdentity, storyRecipients } from "@bibliothecadao/notifications";

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
  const filtered = rows.filter((row) => matchesEventsFilter(row, filter, address));
  return oneRowPerId(filtered.toSorted((left, right) => right.at - left.at));
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

/** Each row once: the same event reached by two sources (a send listed twice, a headline told again) is one row. */
const oneRowPerId = (rows: ImportantFeedRow[]): ImportantFeedRow[] => {
  const seen = new Set<string>();
  return rows.filter((row) => !seen.has(row.id) && seen.add(row.id) !== undefined);
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
 * What a strip row is to the player: one action, whichever row tells it. A send and every story its transaction wrote
 * share the transaction's key; any other row is its own.
 */
const actionKey = (row: ImportantFeedRow): string => {
  if (row.kind === "transaction") return sendKey(row.transaction.hash);
  if (row.kind === "story") return sendKey(row.event.tx_hash);
  return row.id;
};

/**
 * A capture is the outcome of the fight that won it, so of one transaction's rows it tells the action, wherever the
 * chain wrote it among them (the contract writes the capture before its battle) and whichever arrived first.
 */
const isCapture = (row: ImportantFeedRow): boolean =>
  row.kind === "story" && row.event.story === "StructureCapturedStory";

/** A send's key, the same however its hash is written (case, leading zeros). */
export const sendKey = (hash: string): string => `send:${hash.toLowerCase().replace(/^0x0*/, "")}`;

/** A row Events shows: its action's key and the action's latest words. */
export interface ShownRow {
  key: string;
  row: ImportantFeedRow;
}

/**
 * The Events strip, one rule: the newest `count` actions, newest on top, each once with its latest words, and they
 * stay until newer ones replace them. A send keeps its key as its story arrives, so its row stays the same row.
 */
export const latestActions = (rows: ImportantFeedRow[], count: number): ShownRow[] => {
  const latest = new Map<string, ImportantFeedRow>();
  for (const row of rows.toSorted((left, right) => right.at - left.at)) {
    const key = actionKey(row);
    const held = latest.get(key);
    if (!held || (isCapture(row) && !isCapture(held))) latest.set(key, row);
  }
  return [...latest].slice(0, count).map(([key, row]) => ({ key, row }));
};
