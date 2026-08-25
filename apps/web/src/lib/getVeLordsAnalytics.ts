import type { SQL } from "@realms-world/db";
import {
  aggregateLockActivityByWeek,
  aggregateRewardsBySource,
  aggregateRewardsByWeek,
  getPeriodRange,
  sumRewardsInLastNDays,
} from "@/lib/velords-analytics";
import type { VelordsPeriod } from "@/lib/velords-analytics";
import { and, eq, gte, lte } from "@realms-world/db";
import { db } from "@realms-world/db/client";
import {
  velords_lords_locked,
  velords_rewards_received,
} from "@realms-world/db/schema";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VelordsPeriodSchema = z.enum(["3m", "6m", "1y"]);

const GetVelordsAnalyticsInput = z.object({
  period: VelordsPeriodSchema.optional(),
  source: z.string().optional(),
});

function resolvePeriod(
  value?: z.infer<typeof VelordsPeriodSchema>,
): VelordsPeriod {
  return value ?? "3m";
}

export const getVelordsOverview = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetVelordsAnalyticsInput.parse(input))
  .handler(async (ctx) => {
    const period = resolvePeriod(ctx.data.period);
    const { start, end } = getPeriodRange(period, new Date());

    const rewardsRows = await db.query.velords_rewards_received.findMany({
      where: and(
        gte(velords_rewards_received.timestamp, start),
        lte(velords_rewards_received.timestamp, end),
      ),
    });

    const rewards7dWei = sumRewardsInLastNDays(rewardsRows, 7, end);
    const rewards30dWei = sumRewardsInLastNDays(rewardsRows, 30, end);
    const totalPeriodRewardsWei = rewardsRows
      .reduce((acc, row) => acc + BigInt(row.amount.toString()), 0n)
      .toString();
    const sources = aggregateRewardsBySource(rewardsRows);

    return {
      period,
      asOf: end,
      rewards7dWei,
      rewards30dWei,
      totalPeriodRewardsWei,
      topSource: sources[0] ?? null,
    };
  });

export const getVelordsRewardsSeries = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetVelordsAnalyticsInput.parse(input))
  .handler(async (ctx) => {
    const period = resolvePeriod(ctx.data.period);
    const { start, end } = getPeriodRange(period, new Date());

    const whereFilters: SQL[] = [
      gte(velords_rewards_received.timestamp, start),
      lte(velords_rewards_received.timestamp, end),
    ];

    const normalizedSource = ctx.data.source?.toLowerCase();
    if (normalizedSource) {
      whereFilters.push(
        eq(velords_rewards_received.sender, normalizedSource),
      );
    }

    const rewardsRows = await db.query.velords_rewards_received.findMany({
      where: and(...whereFilters),
    });

    const weekly = aggregateRewardsByWeek(rewardsRows, start, end);
    const sources = aggregateRewardsBySource(rewardsRows);
    const totalRewardsWei = rewardsRows
      .reduce((acc, row) => acc + BigInt(row.amount.toString()), 0n)
      .toString();

    return {
      period,
      start,
      end,
      weekly,
      sources,
      totalRewardsWei,
    };
  });

export const getVelordsLockActivity = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        period: VelordsPeriodSchema.optional(),
      })
      .parse(input),
  )
  .handler(async (ctx) => {
    const period = resolvePeriod(ctx.data.period);
    const { start, end } = getPeriodRange(period, new Date());

    const lockRows = await db.query.velords_lords_locked.findMany({
      where: and(
        gte(velords_lords_locked.timestamp, start),
        lte(velords_lords_locked.timestamp, end),
      ),
    });

    const weekly = aggregateLockActivityByWeek(lockRows, start, end);
    const totalUpdates = weekly.reduce((acc, row) => acc + row.updates, 0);
    const uniqueWalletsInPeriod = new Set(
      lockRows.map((row) => row.owner.toLowerCase()),
    ).size;

    return {
      period,
      start,
      end,
      weekly,
      totalUpdates,
      uniqueWalletsInPeriod,
    };
  });

export const getVelordsOverviewQueryOptions = (
  input?: z.infer<typeof GetVelordsAnalyticsInput>,
) =>
  queryOptions({
    queryKey: ["velordsOverview", input],
    queryFn: () => getVelordsOverview({ data: input ?? {} }),
  });

export const getVelordsRewardsSeriesQueryOptions = (
  input?: z.infer<typeof GetVelordsAnalyticsInput>,
) =>
  queryOptions({
    queryKey: ["velordsRewardsSeries", input],
    queryFn: () => getVelordsRewardsSeries({ data: input ?? {} }),
  });

export const getVelordsLockActivityQueryOptions = (
  input?: { period?: VelordsPeriod },
) =>
  queryOptions({
    queryKey: ["velordsLockActivity", input],
    queryFn: () => getVelordsLockActivity({ data: input ?? {} }),
  });
