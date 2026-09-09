import type { Headline } from "../news-headlines/headline-types";
import { TransactionType } from "@bibliothecadao/provider";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { FeedRow, FeedRows } from "./event-feed-rows";

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
  [event.owner, event.storyPayload.attacker_owner_address, event.storyPayload.defender_owner_address].some((owner) =>
    sameOwner(owner, address),
  );

export const battleIdentity = (event: ProcessedStoryEvent): string =>
  [
    event.tx_hash,
    event.timestampMs,
    event.storyPayload.attacker_id,
    event.storyPayload.defender_id,
    event.storyPayload.attacker_troops_before,
    event.storyPayload.defender_troops_before,
  ].join(":");

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
    .filter((event) => event.story === "BattleStory" && (filter !== "mine" || involvesPlayer(event, address)))
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

export function groupFeedRowsByTick(
  rows: ImportantFeedRow[],
  tickSeconds: number,
): Array<{ tick: number; rows: ImportantFeedRow[] }> {
  if (!Number.isFinite(tickSeconds) || tickSeconds <= 0)
    throw new Error("The event feed requires the configured army tick duration");
  const groups = new Map<number, ImportantFeedRow[]>();
  for (const row of [...rows].sort((left, right) => right.at - left.at)) {
    const tick = Math.floor(row.at / 1000 / tickSeconds);
    const group = groups.get(tick) ?? [];
    group.push(row);
    groups.set(tick, group);
  }
  return [...groups].map(([tick, rows]) => ({ tick, rows }));
}
