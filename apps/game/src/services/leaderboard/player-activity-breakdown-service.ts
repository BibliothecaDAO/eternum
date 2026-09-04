import { getActiveWorld } from "@/runtime/world";
import { fetchHeraldGameHistory } from "@/runtime/world/herald-http";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { configManager } from "@bibliothecadao/eternum";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";

export interface PlayerActivityStat {
  count: number;
  points: number;
}

export interface PlayerActivityBreakdown {
  exploration: PlayerActivityStat;
  openRelicChest: PlayerActivityStat;
  hyperStructureBanditsDefeat: PlayerActivityStat;
  otherStructureBanditsDefeat: PlayerActivityStat;
  hyperstructureShare: PlayerActivityStat;
}

export interface PlayerLeaderboardActivityEntry {
  address: string;
  activityBreakdown: PlayerActivityBreakdown;
  totalPoints: number;
  rank: number | null;
}

const POINTS_PRECISION = 1_000_000;
const HISTORY_PAGE_SIZE = 500;

const emptyBreakdown = (): PlayerActivityBreakdown => ({
  exploration: { count: 0, points: 0 },
  openRelicChest: { count: 0, points: 0 },
  hyperStructureBanditsDefeat: { count: 0, points: 0 },
  otherStructureBanditsDefeat: { count: 0, points: 0 },
  hyperstructureShare: { count: 0, points: 0 },
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const pointsRegistration = (
  event: HeraldHistoryEvent,
): { activity: keyof PlayerActivityBreakdown; address: string; points: number } | null => {
  const story = asRecord(event.value.story);
  const payload = asRecord(story?.PointsRegisteredStory);
  if (!payload) return null;
  const activity = String(payload.activity) as keyof PlayerActivityBreakdown;
  if (!Object.hasOwn(emptyBreakdown(), activity)) return null;
  try {
    return {
      activity,
      address: `0x${BigInt(String(payload.owner_address)).toString(16)}`,
      points: Number(BigInt(String(payload.points))) / POINTS_PRECISION,
    };
  } catch {
    return null;
  }
};

const fetchStoryHistory = async (): Promise<HeraldHistoryEvent[]> => {
  const profile = getActiveWorld();
  const world = getWorldById(profile?.worldId ?? "blitz") ?? getDefaultWorld();
  const gameId = configManager.getActiveGameId();
  const events: HeraldHistoryEvent[] = [];
  for (let offset = 0; ; offset += HISTORY_PAGE_SIZE) {
    const page = await fetchHeraldGameHistory(world, gameId, {
      limit: HISTORY_PAGE_SIZE,
      model: "StoryEvent",
      offset,
    });
    events.push(...page.items);
    if (events.length >= page.total || page.items.length === 0) return events;
  }
};

export const fetchLeaderboardActivityBreakdowns = async (limit: number): Promise<PlayerLeaderboardActivityEntry[]> => {
  if (limit <= 0) return [];
  const breakdowns = new Map<string, PlayerActivityBreakdown>();
  for (const event of await fetchStoryHistory()) {
    const registration = pointsRegistration(event);
    if (!registration) continue;
    const breakdown = breakdowns.get(registration.address) ?? emptyBreakdown();
    const activity = breakdown[registration.activity];
    activity.count += 1;
    activity.points += registration.points;
    breakdowns.set(registration.address, breakdown);
  }

  return [...breakdowns.entries()]
    .map(([address, activityBreakdown]) => ({
      address,
      activityBreakdown,
      totalPoints: Object.values(activityBreakdown).reduce((sum, activity) => sum + activity.points, 0),
      rank: null,
    }))
    .toSorted((left, right) => right.totalPoints - left.totalPoints)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};
