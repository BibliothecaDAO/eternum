import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { record, type Row } from "./values";

/** The receipt kinds used by season history, replay and reward totals. */
export const FRONTIER_REWARD_STORIES = ["SitePayout", "ExplorationReward", "RewardChestOpened"] as const;

export function frontierRewardOf(
  event: HeraldHistoryEvent,
): { kind: (typeof FRONTIER_REWARD_STORIES)[number]; payload: Row } | undefined {
  if (event.model !== "StoryEvent") return undefined;
  const story = record(event.value.story);
  const kind = FRONTIER_REWARD_STORIES.find((name) => Object.hasOwn(story, name));
  return kind === undefined ? undefined : { kind, payload: record(story[kind]) };
}
