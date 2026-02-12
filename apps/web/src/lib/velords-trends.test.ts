/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it } from "vitest";

import {
  buildCumulativeRewardsData,
  buildLockParticipationData,
  buildRewardsMomentumData,
  buildSourceConcentrationData,
  buildSourceShareData,
  calculateProjectedPeriodTotal,
} from "./velords-trends";

const weekRows = [
  {
    week: "2026-01-05",
    totalWei: "1000000000000000000",
    txCount: 2,
    bySender: {
      "0xa": "700000000000000000",
      "0xb": "300000000000000000",
    },
  },
  {
    week: "2026-01-12",
    totalWei: "2000000000000000000",
    txCount: 2,
    bySender: {
      "0xa": "1000000000000000000",
      "0xb": "1000000000000000000",
    },
  },
  {
    week: "2026-01-19",
    totalWei: "3000000000000000000",
    txCount: 3,
    bySender: {
      "0xa": "1500000000000000000",
      "0xb": "1500000000000000000",
    },
  },
  {
    week: "2026-01-26",
    totalWei: "4000000000000000000",
    txCount: 4,
    bySender: {
      "0xa": "2000000000000000000",
      "0xb": "2000000000000000000",
    },
  },
  {
    week: "2026-02-02",
    totalWei: "5000000000000000000",
    txCount: 5,
    bySender: {
      "0xa": "1000000000000000000",
      "0xb": "4000000000000000000",
    },
  },
] as const;

describe("buildRewardsMomentumData", () => {
  it("builds weekly totals and 4w moving average", () => {
    const points = buildRewardsMomentumData(weekRows);

    expect(points).toHaveLength(5);
    expect(points[0].totalRewards).toBe(1);
    expect(points[0].movingAvg4w).toBe(1);
    expect(points[4].totalRewards).toBe(5);
    expect(points[4].movingAvg4w).toBe(3.5);
  });
});

describe("buildSourceShareData", () => {
  it("keeps top sources and buckets remaining into other", () => {
    const { points, sourceKeys } = buildSourceShareData(weekRows, 1);

    expect(sourceKeys).toEqual(["0xb", "other"]);
    expect(points[0]["0xb"]).toBe(30);
    expect(points[0].other).toBe(70);
    expect(points[4]["0xb"]).toBe(80);
    expect(points[4].other).toBe(20);
  });
});

describe("buildSourceConcentrationData", () => {
  it("computes top-1, top-3 and active source count", () => {
    const points = buildSourceConcentrationData(weekRows);

    expect(points[0].top1Share).toBe(70);
    expect(points[0].top3Share).toBe(100);
    expect(points[0].activeSources).toBe(2);
    expect(points[4].top1Share).toBe(80);
  });
});

describe("buildLockParticipationData", () => {
  it("calculates weekly updates-per-wallet ratios", () => {
    const points = buildLockParticipationData([
      { week: "2026-01-05", updates: 12, uniqueWallets: 6 },
      { week: "2026-01-12", updates: 7, uniqueWallets: 0 },
    ]);

    expect(points[0].updatesPerWallet).toBe(2);
    expect(points[1].updatesPerWallet).toBe(0);
  });
});

describe("buildCumulativeRewardsData", () => {
  it("accumulates weekly rewards over time", () => {
    const points = buildCumulativeRewardsData(weekRows);

    expect(points.map((point) => point.cumulativeRewards)).toEqual([
      1,
      3,
      6,
      10,
      15,
    ]);
  });
});

describe("calculateProjectedPeriodTotal", () => {
  it("projects period total using trailing four-week average", () => {
    const value = calculateProjectedPeriodTotal(weekRows);

    expect(value).toBeCloseTo(17.5, 5);
  });
});
