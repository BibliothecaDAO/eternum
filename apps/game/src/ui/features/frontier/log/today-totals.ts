import { normalizeLeaderboardAddress } from "@/services/leaderboard/landing-leaderboard-service";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

/**
 * What the player's day added up to, for the top of Frontier's log: reveals and what they paid, sites cleared and
 * chests opened, folded from the player's own stories within today's epoch. The log's look comes from the visual redo.
 */
interface OwnStory {
  story: string;
  storyPayload: Record<string, unknown>;
  owner: string | null;
  timestampMs: number;
}

interface DayTotals {
  reveals: number;
  sitesCleared: number;
  chests: number;
  essence: number;
  labor: number;
}

const PRECISION = BigInt(RESOURCE_PRECISION);

export const totalToday = (
  stories: readonly OwnStory[],
  player: string,
  day: { startMs: number; endMs: number },
): DayTotals => {
  const own = normalizeLeaderboardAddress(player);
  const totals: DayTotals = { reveals: 0, sitesCleared: 0, chests: 0, essence: 0, labor: 0 };
  for (const { story, storyPayload, owner, timestampMs } of stories) {
    if (normalizeLeaderboardAddress(owner) !== own || timestampMs < day.startMs || timestampMs >= day.endMs) continue;
    if (story === "ExplorationReward") {
      totals.reveals += 1;
      addReward(totals, storyPayload.resource_type, storyPayload.amount);
    } else if (story === "SitePayout") {
      totals.sitesCleared += 1;
      const reward = someReward(storyPayload.reward);
      if (reward) addReward(totals, reward.resource_type, reward.amount);
    } else if (story === "ChestReward") totals.chests += 1;
  }
  return totals;
};

const addReward = (totals: DayTotals, resourceType: unknown, amount: unknown): void => {
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
