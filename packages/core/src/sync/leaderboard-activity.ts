interface PlayerActivityStat {
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
  rank: number;
}

const ACTIVITY_KEYS: Record<string, keyof PlayerActivityBreakdown> = {
  Exploration: "exploration",
  OpenRelicChest: "openRelicChest",
  HyperStructureBanditsDefeat: "hyperStructureBanditsDefeat",
  OtherStructureBanditsDefeat: "otherStructureBanditsDefeat",
  HyperstructureSharePoints: "hyperstructureShare",
};

export const createEmptyActivityBreakdown = (): PlayerActivityBreakdown => ({
  exploration: { count: 0, points: 0 },
  openRelicChest: { count: 0, points: 0 },
  hyperStructureBanditsDefeat: { count: 0, points: 0 },
  otherStructureBanditsDefeat: { count: 0, points: 0 },
  hyperstructureShare: { count: 0, points: 0 },
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

export function readPointsRegistration(value: Record<string, unknown>) {
  const payload = asRecord(asRecord(value.story)?.PointsRegisteredStory);
  if (!payload) return null;
  const variant = String(payload.activity);
  if (!Object.hasOwn(ACTIVITY_KEYS, variant)) throw new Error(`Unknown points activity: ${variant}`);
  const owner = BigInt(String(payload.owner_address));
  const points = BigInt(String(payload.points));
  if (owner <= 0n || points < 0n) throw new Error("Invalid points registration owner or amount");
  return { address: `0x${owner.toString(16)}`, activity: ACTIVITY_KEYS[variant], points: Number(points) / 1_000_000 };
}
