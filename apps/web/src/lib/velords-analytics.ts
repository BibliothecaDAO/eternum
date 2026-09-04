import { formatUnits } from "viem";

export type VelordsPeriod = "3m" | "6m" | "1y";

export interface RewardRow {
  sender: string;
  amount: string | number | bigint;
  timestamp: Date | string | number;
}

export interface LockRow {
  owner: string;
  timestamp: Date | string | number;
}

interface WeeklyBase {
  week: string;
}

export interface WeeklyRewardBucket extends WeeklyBase {
  totalWei: string;
  txCount: number;
  bySender: Record<string, string>;
}

export interface SourceBreakdownRow {
  sender: string;
  totalWei: string;
  txCount: number;
  sharePercent: string;
}

export interface WeeklyLockActivityBucket extends WeeklyBase {
  updates: number;
  uniqueWallets: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEK_IN_MS = 7 * DAY_IN_MS;

const PERIOD_TO_DAYS: Record<VelordsPeriod, number> = {
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;

  if (typeof input === "number") {
    const normalized = input < 10_000_000_000 ? input * 1000 : input;
    return new Date(normalized);
  }

  const asNumber = Number(input);
  if (!Number.isNaN(asNumber)) {
    const normalized = asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
    return new Date(normalized);
  }

  return new Date(input);
}

function toWeekStartUtc(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  const day = normalized.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  normalized.setUTCDate(normalized.getUTCDate() - mondayOffset);
  return normalized;
}

function toWeekKey(date: Date): string {
  return toWeekStartUtc(date).toISOString().slice(0, 10);
}

function toBigIntAmount(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value);
}

function sumBigInt(values: Iterable<bigint>): bigint {
  let total = 0n;
  for (const value of values) total += value;
  return total;
}

function formatSharePercent(numerator: bigint, denominator: bigint): string {
  if (denominator <= 0n || numerator <= 0n) return "0.00";
  const scale = 10_000n; // two decimal places in percent space.
  const scaled = (numerator * 100n * scale) / denominator;
  const intPart = scaled / scale;
  const fracPart = (scaled % scale).toString().padStart(4, "0").slice(0, 2);
  return `${intPart}.${fracPart}`;
}

export function getPeriodRange(period: VelordsPeriod, now: Date = new Date()): { start: Date; end: Date } {
  const end = new Date(now);
  const start = new Date(end.getTime() - PERIOD_TO_DAYS[period] * DAY_IN_MS);
  return { start, end };
}

export function aggregateRewardsByWeek(rows: RewardRow[], start: Date, end: Date): WeeklyRewardBucket[] {
  const startWeek = toWeekStartUtc(start);
  const endWeek = toWeekStartUtc(end);

  const weekly = new Map<string, WeeklyRewardBucket>();
  for (let cursor = startWeek.getTime(); cursor <= endWeek.getTime(); cursor += WEEK_IN_MS) {
    const key = new Date(cursor).toISOString().slice(0, 10);
    weekly.set(key, {
      week: key,
      totalWei: "0",
      txCount: 0,
      bySender: {},
    });
  }

  for (const row of rows) {
    const timestamp = toDate(row.timestamp);
    if (timestamp < start || timestamp > end) continue;

    const week = toWeekKey(timestamp);
    const bucket = weekly.get(week);
    if (!bucket) continue;

    const amountWei = toBigIntAmount(row.amount);
    bucket.totalWei = (BigInt(bucket.totalWei) + amountWei).toString();
    bucket.txCount += 1;

    const previous = bucket.bySender[row.sender] ? BigInt(bucket.bySender[row.sender] ?? "0") : 0n;
    bucket.bySender[row.sender] = (previous + amountWei).toString();
  }

  return Array.from(weekly.values()).sort((a, b) => a.week.localeCompare(b.week));
}

export function aggregateRewardsBySource(rows: RewardRow[]): SourceBreakdownRow[] {
  const bySource = new Map<
    string,
    {
      totalWei: bigint;
      txCount: number;
    }
  >();

  for (const row of rows) {
    const current = bySource.get(row.sender) ?? { totalWei: 0n, txCount: 0 };
    current.totalWei += toBigIntAmount(row.amount);
    current.txCount += 1;
    bySource.set(row.sender, current);
  }

  const grandTotal = sumBigInt(Array.from(bySource.values()).map((entry) => entry.totalWei));

  return Array.from(bySource.entries())
    .map(([sender, entry]) => ({
      sender,
      totalWei: entry.totalWei.toString(),
      txCount: entry.txCount,
      sharePercent: formatSharePercent(entry.totalWei, grandTotal),
    }))
    .sort((a, b) => {
      const bAmount = BigInt(b.totalWei);
      const aAmount = BigInt(a.totalWei);
      if (bAmount === aAmount) return 0;
      return bAmount > aAmount ? 1 : -1;
    });
}

export function sumRewardsInLastNDays(rows: RewardRow[], days: number, now: Date = new Date()): string {
  const threshold = now.getTime() - days * DAY_IN_MS;
  const total = rows.reduce((acc, row) => {
    const timestamp = toDate(row.timestamp).getTime();
    if (timestamp < threshold || timestamp > now.getTime()) return acc;
    return acc + toBigIntAmount(row.amount);
  }, 0n);
  return total.toString();
}

export function aggregateLockActivityByWeek(rows: LockRow[], start: Date, end: Date): WeeklyLockActivityBucket[] {
  const startWeek = toWeekStartUtc(start);
  const endWeek = toWeekStartUtc(end);

  const weekly = new Map<
    string,
    {
      updates: number;
      owners: Set<string>;
    }
  >();

  for (let cursor = startWeek.getTime(); cursor <= endWeek.getTime(); cursor += WEEK_IN_MS) {
    const key = new Date(cursor).toISOString().slice(0, 10);
    weekly.set(key, { updates: 0, owners: new Set<string>() });
  }

  for (const row of rows) {
    const timestamp = toDate(row.timestamp);
    if (timestamp < start || timestamp > end) continue;
    const week = toWeekKey(timestamp);
    const bucket = weekly.get(week);
    if (!bucket) continue;
    bucket.updates += 1;
    bucket.owners.add(row.owner.toLowerCase());
  }

  return Array.from(weekly.entries())
    .map(([week, value]) => ({
      week,
      updates: value.updates,
      uniqueWallets: value.owners.size,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export function calculateTrailingApyPercent(weeklyTotalsWei: string[], veSupplyRaw?: bigint): number {
  if (!veSupplyRaw || veSupplyRaw <= 0n) return 0;
  if (weeklyTotalsWei.length === 0) return 0;

  const sumRewards = weeklyTotalsWei.reduce((acc, amountWei) => acc + BigInt(amountWei), 0n);
  const avgWeeklyRewards = Number(formatUnits(sumRewards, 18)) / weeklyTotalsWei.length;
  const totalSupply = Number(formatUnits(veSupplyRaw, 18));
  if (!Number.isFinite(totalSupply) || totalSupply <= 0) return 0;

  return (avgWeeklyRewards * 52 * 100) / totalSupply;
}
