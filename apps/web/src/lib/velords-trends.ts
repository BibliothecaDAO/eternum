import { formatUnits } from "viem";

export interface WeeklyRewardsPoint {
  week: string;
  totalWei: string;
  bySender: Record<string, string>;
}

export interface WeeklyLockPoint {
  week: string;
  updates: number;
  uniqueWallets: number;
}

export interface RewardsMomentumPoint {
  week: string;
  totalRewards: number;
  movingAvg4w: number;
}

export interface SourceSharePoint {
  week: string;
  other: number;
  [sourceKey: string]: number | string;
}

export interface SourceConcentrationPoint {
  week: string;
  top1Share: number;
  top3Share: number;
  activeSources: number;
}

export interface LockParticipationPoint {
  week: string;
  updates: number;
  uniqueWallets: number;
  updatesPerWallet: number;
}

export interface CumulativeRewardsPoint {
  week: string;
  cumulativeRewards: number;
}

function toRewardsUnits(wei: string): number {
  return Number(formatUnits(BigInt(wei), 18));
}

function toPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

export function buildRewardsMomentumData(weekly: WeeklyRewardsPoint[]): RewardsMomentumPoint[] {
  return weekly.map((row, index) => {
    const totalRewards = toRewardsUnits(row.totalWei);
    const trailing = weekly.slice(Math.max(0, index - 3), index + 1);
    const trailingSum = trailing.reduce((acc, point) => acc + toRewardsUnits(point.totalWei), 0);

    return {
      week: row.week,
      totalRewards,
      movingAvg4w: trailing.length > 0 ? trailingSum / trailing.length : 0,
    };
  });
}

export function buildSourceShareData(
  weekly: WeeklyRewardsPoint[],
  maxSources = 5,
): { points: SourceSharePoint[]; sourceKeys: string[] } {
  const totalsBySource = new Map<string, bigint>();

  for (const row of weekly) {
    for (const [source, amount] of Object.entries(row.bySender)) {
      const previous = totalsBySource.get(source) ?? 0n;
      totalsBySource.set(source, previous + BigInt(amount));
    }
  }

  const topSources = Array.from(totalsBySource.entries())
    .sort((a, b) => {
      if (a[1] === b[1]) return 0;
      return a[1] > b[1] ? -1 : 1;
    })
    .slice(0, maxSources)
    .map(([source]) => source);

  const points: SourceSharePoint[] = weekly.map((row) => {
    const totalRewards = toRewardsUnits(row.totalWei);
    let trackedShare = 0;

    const point: SourceSharePoint = {
      week: row.week,
      other: 0,
    };

    for (const source of topSources) {
      const amount = row.bySender[source] ?? "0";
      const sourceShare = toPercent(toRewardsUnits(amount), totalRewards);
      point[source] = sourceShare;
      trackedShare += sourceShare;
    }

    point.other = Math.max(0, 100 - trackedShare);
    return point;
  });

  return {
    points,
    sourceKeys: [...topSources, "other"],
  };
}

export function buildSourceConcentrationData(weekly: WeeklyRewardsPoint[]): SourceConcentrationPoint[] {
  return weekly.map((row) => {
    const amounts = Object.values(row.bySender)
      .map((amount) => toRewardsUnits(amount))
      .filter((value) => value > 0)
      .sort((a, b) => b - a);

    const totalRewards = toRewardsUnits(row.totalWei);
    const top1 = amounts[0] ?? 0;
    const top3 = amounts.slice(0, 3).reduce((acc, value) => acc + value, 0);

    return {
      week: row.week,
      top1Share: toPercent(top1, totalRewards),
      top3Share: toPercent(top3, totalRewards),
      activeSources: amounts.length,
    };
  });
}

export function buildLockParticipationData(weekly: WeeklyLockPoint[]): LockParticipationPoint[] {
  return weekly.map((row) => ({
    ...row,
    updatesPerWallet: row.uniqueWallets > 0 ? row.updates / row.uniqueWallets : 0,
  }));
}

export function buildCumulativeRewardsData(weekly: WeeklyRewardsPoint[]): CumulativeRewardsPoint[] {
  let cumulative = 0;

  return weekly.map((row) => {
    cumulative += toRewardsUnits(row.totalWei);
    return {
      week: row.week,
      cumulativeRewards: cumulative,
    };
  });
}

export function calculateProjectedPeriodTotal(weekly: WeeklyRewardsPoint[]): number {
  if (weekly.length === 0) return 0;

  const trailing = weekly.slice(-4);
  const trailingAverage = trailing.reduce((acc, row) => acc + toRewardsUnits(row.totalWei), 0) / trailing.length;

  return trailingAverage * weekly.length;
}
