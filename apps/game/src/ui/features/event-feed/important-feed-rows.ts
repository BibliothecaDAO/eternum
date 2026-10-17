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
 * that story, whatever the story's notification level, so a send's row tells its outcome (what an explore found).
 * Routine moves and point accrual remain in the world history.
 */
export function selectImportantFeedRows(
  stories: ProcessedStoryEvent[],
  feed: FeedRows,
  filter: ImportantFeedFilter,
  address: string | null,
  headlines: Headline[] = [],
): ImportantFeedRow[] {
  const shown = oneStoryPerAction(
    withSendOutcomes(
      stories.filter((event) => isEventsStory(event, filter, address)),
      stories,
      filter === "combat" ? [] : [...feed.inFlight, ...feed.recent],
    ),
  );
  const rows: ImportantFeedRow[] = shown.map((event) => ({
    kind: "story",
    id: `story:${event.id}`,
    at: event.timestampMs,
    event,
  }));
  if (filter !== "combat") {
    const told = new Set(shown.map((event) => sendKey(event.tx_hash)));
    rows.push(
      ...[...feed.inFlight, ...feed.recent].filter((row) => isImportantPersonalRow(row) && !isToldByStory(row, told)),
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

/** A battle or raid, anyone's unless the filter asks for the player's; a realm's news only when it is the player's. */
const isEventsStory = (event: ProcessedStoryEvent, filter: ImportantFeedFilter, address: string | null): boolean => {
  if (includesStoryNotification("important", event.story)) return filter !== "mine" || involvesPlayer(event, address);
  return filter !== "combat" && includesStoryNotification("standard", event.story) && involvesPlayer(event, address);
};

/**
 * What a quick-feed row is to the player: one action, whichever row tells it, however long its sources keep it. A send
 * and every story its transaction wrote share the transaction's key; any other row is its own.
 */
const quickFeedKey = (row: ImportantFeedRow): string => {
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

/** Whether a row is about the player: their own sends, caravans and notices, and the stories that name them. */
const isAboutPlayer = (row: ImportantFeedRow, address: string | null): boolean =>
  row.kind === "story"
    ? [row.event.owner, ...row.event.participants].some((player) => player !== null && feltEquals(player, address))
    : row.kind !== "headline";

/** A row Events shows: its action's key and its latest words. */
export interface ShownRow {
  key: string;
  row: ImportantFeedRow;
}

/** What Events holds between renders: the rows shown, top first, and the actions whose time on screen is over. */
export interface QuickFeed {
  shown: readonly ShownRow[];
  ended: readonly string[];
}

/** How many ended actions Events remembers, so none comes back; far more than can be recent at once. */
const ENDED_MEMORY = 200;

/**
 * Events' own short list, one rule: a row stays on screen 20 s from when it is first shown (its fade is its clock), in
 * its place, with its action's latest words, even once its sources drop it. Never more than `maxRows` at once. A row
 * about the player comes in on top when it arrives; with every slot taken, it takes the slot of the oldest shown row
 * not about the player (or, when all are the player's, the oldest), whose time on screen ends there, so none of the
 * player's actions is lost to a full card. A row not about the player comes in only to a free slot, so
 * it never displaces one of the player's. A row comes in only while its event is within the window of now, and an
 * action whose time on screen is over never comes back.
 */
export function nextQuickFeed(
  feed: QuickFeed,
  rows: ImportantFeedRow[],
  context: { nowMs: number; address: string | null; windowMs: number; maxRows: number },
): QuickFeed {
  const latest = new Map<string, ImportantFeedRow>();
  for (const row of rows.toSorted((left, right) => right.at - left.at)) {
    const key = quickFeedKey(row);
    const held = latest.get(key);
    if (!held || (isCapture(row) && !isCapture(held))) latest.set(key, row);
  }
  const ended = [...feed.ended];
  let shown = feed.shown
    .filter((entry) => !ended.includes(entry.key))
    .map((entry) => ({ ...entry, row: latest.get(entry.key) ?? entry.row }));
  const arriving = [...latest].filter(
    ([key, row]) =>
      !ended.includes(key) &&
      !shown.some((entry) => entry.key === key) &&
      Math.abs(context.nowMs - row.at) < context.windowMs,
  );
  // Newest first, so a free slot goes to the newest; those let in go on top, newest highest.
  const admitted: ShownRow[] = [];
  for (const [key, row] of arriving) {
    if (admitted.length + shown.length >= context.maxRows) {
      if (!isAboutPlayer(row, context.address)) continue;
      // The oldest row not about the player gives way; with every slot the player's own, the oldest of those does, so
      // no action of the player's waits for a slot until its time to show has passed.
      const displaced =
        shown.findLast((entry) => !isAboutPlayer(entry.row, context.address)) ?? shown[shown.length - 1];
      if (!displaced) continue;
      shown = shown.filter((entry) => entry !== displaced);
      ended.push(displaced.key);
    }
    admitted.push({ key, row });
  }
  return { shown: [...admitted, ...shown], ended: ended.slice(-ENDED_MEMORY) };
}

/** The feed once an action's time on screen is over: its row leaves, and the action never comes back. */
export const endQuickFeedRow = (feed: QuickFeed, key: string): QuickFeed => ({
  shown: feed.shown.filter((entry) => entry.key !== key),
  ended: [...feed.ended, key].slice(-ENDED_MEMORY),
});
