import { normalizeLeaderboardAddress } from "@/services/leaderboard/landing-leaderboard-service";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

/** A story as the day's totals read it: whose it is and when. */
interface OwnStory {
  story: string;
  storyPayload: Record<string, unknown>;
  owner: string | null;
  timestampMs: number;
}

interface StoryTotals {
  reveals: number;
  cleared: number;
  chests: number;
  essence: number;
  labor: number;
}

const PRECISION = BigInt(RESOURCE_PRECISION);

type DayBounds = { startMs: number; endMs: number };

/** The player's own stories within one day, in the order given. */
export const ownStoriesOfDay = <Story extends OwnStory>(
  stories: readonly Story[],
  player: string,
  day: DayBounds,
): Story[] => {
  const own = normalizeLeaderboardAddress(player);
  return stories.filter(
    ({ owner, timestampMs }) =>
      normalizeLeaderboardAddress(owner) === own && timestampMs >= day.startMs && timestampMs < day.endMs,
  );
};

/**
 * What the player's day added up to: reveals and what they paid, sites cleared and chests opened, folded from the
 * player's own stories within the day.
 */
export const totalToday = (stories: readonly OwnStory[], player: string, day: DayBounds): StoryTotals => {
  const totals: StoryTotals = { reveals: 0, cleared: 0, chests: 0, essence: 0, labor: 0 };
  for (const { story, storyPayload } of ownStoriesOfDay(stories, player, day)) {
    if (story === "ExplorationReward") {
      totals.reveals += 1;
      addReward(totals, storyPayload.resource_type, storyPayload.amount);
    } else if (story === "SitePayout") {
      totals.cleared += 1;
      const reward = someReward(storyPayload.reward);
      if (reward) addReward(totals, reward.resource_type, reward.amount);
    } else if (story === "ChestReward") totals.chests += 1;
  }
  return totals;
};

const addReward = (totals: StoryTotals, resourceType: unknown, amount: unknown): void => {
  const whole = Number(BigInt(String(amount)) / PRECISION);
  if (Number(resourceType) === ResourcesIds.Essence) totals.essence += whole;
  else if (Number(resourceType) === ResourcesIds.Labor) totals.labor += whole;
};

/** A payout's reward in either option form Herald writes: the value itself, {"Some": value}, or none. */
const someReward = (reward: unknown): { resource_type: unknown; amount: unknown } | null => {
  if (!reward || typeof reward !== "object") return null;
  const value = "Some" in reward ? (reward as { Some: unknown }).Some : reward;
  return value && typeof value === "object" && "amount" in value
    ? (value as { resource_type: unknown; amount: unknown })
    : null;
};
