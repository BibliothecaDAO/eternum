import { normalizeLeaderboardAddress } from "@/services/leaderboard/landing-leaderboard-service";
import { ResourcesIds, scaledToUnits } from "@bibliothecadao/types";

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
  essence: number;
  labor: number;
}

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

/** What the day paid, summed at contract precision so no fraction is lost before the total is written. */
type Paid = { essence: bigint; labor: bigint };

export const totalToday = (stories: readonly OwnStory[], player: string, day: DayBounds): StoryTotals => {
  const counts = { reveals: 0, cleared: 0 };
  const paid: Paid = { essence: 0n, labor: 0n };
  for (const { story, storyPayload } of ownStoriesOfDay(stories, player, day)) {
    if (story === "ExplorationReward") {
      counts.reveals += 1;
      addReward(paid, storyPayload.resource_type, storyPayload.amount);
    } else if (story === "SitePayout") {
      counts.cleared += 1;
      const reward = someReward(storyPayload.reward);
      if (reward) addReward(paid, reward.resource_type, reward.amount);
    }
  }
  return {
    ...counts,
    essence: scaledToUnits(paid.essence),
    labor: scaledToUnits(paid.labor),
  };
};

const addReward = (paid: Paid, resourceType: unknown, amount: unknown): void => {
  const resource = paidResource(resourceType);
  if (resource) paid[resource] += BigInt(String(amount));
};

export const paidResource = (resourceType: unknown): keyof Paid | null => {
  if (Number(resourceType) === ResourcesIds.Essence) return "essence";
  if (Number(resourceType) === ResourcesIds.Labor) return "labor";
  return null;
};

/** A payout's reward in either option form Herald writes: the value itself, {"Some": value}, or none. */
export const someReward = (reward: unknown): { resource_type: unknown; amount: unknown } | null => {
  if (!reward || typeof reward !== "object") return null;
  const value = "Some" in reward ? (reward as { Some: unknown }).Some : reward;
  return value && typeof value === "object" && "amount" in value
    ? (value as { resource_type: unknown; amount: unknown })
    : null;
};
