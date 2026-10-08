import { dayOf } from "@bibliothecadao/eternum/expeditions";
import type { HeraldFrontierDayRanks, HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { buildFrontierLeaderboard } from "./frontier-leaderboard";
import { integer, number, required } from "./values";
import { historyEventOf, type HistoryStore } from "../history-store";
import type { FoldRow } from "../types";
import type { NativeIngestion } from "./ingestion";

/** The pre-boundary snapshot is authoritative for depth and membership; later live rows cannot recover these ranks. */
export function closingFrontierDays(
  modelRows: (model: string) => FoldRow[],
  previousTimestamp: number,
  timestamp: number,
  confirmedBlock: number,
  history: readonly HeraldHistoryEvent[],
): HeraldFrontierDayRanks[] {
  const boards = new Map<string, HeraldFrontierDayRanks["entries"]>();
  return closedDayBounds(modelRows, previousTimestamp, timestamp, confirmedBlock).map((day) => {
    if (!boards.has(day.game_id)) {
      const board = buildFrontierLeaderboard(
        modelRows,
        day.game_id,
        history.filter((event) => integer(event.game_id) === integer(day.game_id)),
      );
      boards.set(
        day.game_id,
        board.entries.map(({ address, structure_id, rank }) => ({ address, structure_id, rank })),
      );
    }
    return { ...day, entries: boards.get(day.game_id)! };
  });
}

function closedDayBounds(
  modelRows: (model: string) => FoldRow[],
  previousTimestamp: number,
  timestamp: number,
  confirmedBlock: number,
): Omit<HeraldFrontierDayRanks, "entries">[] {
  const closed: Omit<HeraldFrontierDayRanks, "entries">[] = [];
  for (const { value: game } of modelRows("GameRegistry")) {
    const unit = number(required(modelRows("SliceRules"), game.game_id, "SliceRules").day_unit_seconds);
    if (unit === 0 || game.settled === true) continue;
    const calendar = { seed: integer(game.seed), startMainAt: number(game.start_main_at), dayUnitSeconds: unit };
    let day = dayOf(calendar, Math.max(previousTimestamp, calendar.startMainAt))!;
    const end = Math.min(timestamp, number(game.end_at));
    if (day.end > end) continue;
    const gameId = integer(game.game_id).toString();
    while (day.end <= end) {
      closed.push({ game_id: gameId, day_index: day.index, ends_at: day.end, confirmed_block: confirmedBlock });
      day = dayOf(calendar, day.end)!;
    }
  }
  return closed;
}

/** Live confirmation and cold replay take the same boundary snapshots, committed with receipt history. */
export async function replayWithFrontierDays(
  native: NativeIngestion,
  history: Pick<HistoryStore, "frontierHistory" | "appendEvents">,
  input: Parameters<NativeIngestion["replay"]>[0],
  confirmedTimestamp?: number,
) {
  const frontierDays: HeraldFrontierDayRanks[] = [];
  const previousHistory = new Map<string, HeraldHistoryEvent[]>();
  const hasCalendar = input.fold.modelRows("SliceRules").some(({ value }) => number(value.day_unit_seconds) !== 0);
  let previousTimestamp =
    confirmedTimestamp ??
    (hasCalendar && input.fromBlock > native.decoder.manifest.native.deploymentBlock
      ? (await input.rpc.getBlockWithReceipts(input.fromBlock - 1)).timestamp
      : 0);
  const replay = await native.replay({
    ...input,
    beforeBlock: async (fold, block, events) => {
      // First locate boundaries without loading season history on every block.
      const boundaries = closedDayBounds(
        (model) => fold.modelRows(model),
        previousTimestamp,
        block.timestamp,
        block.block_number - 1,
      );
      if (boundaries.length) {
        const stories = events.flatMap((event) => {
          const item = historyEventOf(event);
          return item && isFrontierReward(item) ? [item] : [];
        });
        for (const gameId of new Set(boundaries.map((day) => day.game_id))) {
          if (!previousHistory.has(gameId)) {
            previousHistory.set(
              gameId,
              input.fromBlock <= native.decoder.manifest.native.deploymentBlock
                ? []
                : await history.frontierHistory(gameId, input.fromBlock - 1),
            );
          }
        }
        frontierDays.push(
          ...closingFrontierDays(
            (model) => fold.modelRows(model),
            previousTimestamp,
            block.timestamp,
            block.block_number - 1,
            [...previousHistory.values()].flat().concat(stories),
          ),
        );
      }
      previousTimestamp = block.timestamp;
    },
    beforeCommit: (events) =>
      history.appendEvents(
        events.filter((event) => event.kind === "event"),
        input.toBlock,
        frontierDays,
      ),
  });
  return { ...replay, frontierDays };
}

function isFrontierReward(event: HeraldHistoryEvent): boolean {
  const story = event.value.story;
  return (
    event.model === "StoryEvent" &&
    typeof story === "object" &&
    story !== null &&
    (Object.hasOwn(story, "SitePayout") || Object.hasOwn(story, "ExplorationReward"))
  );
}
