import { describe, expect, it } from "vitest";

import {
  aggregateLockActivityByWeek,
  aggregateRewardsBySource,
  aggregateRewardsByWeek,
  getPeriodRange,
  sumRewardsInLastNDays,
} from "../../web/src/lib/velords-analytics";

describe("getPeriodRange", () => {
  it("returns the expected start date for 3m", () => {
    const now = new Date("2026-02-12T00:00:00.000Z");
    const range = getPeriodRange("3m", now);
    expect(range.start.toISOString()).toBe("2025-11-14T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-02-12T00:00:00.000Z");
  });
});

describe("aggregateRewardsByWeek", () => {
  it("groups rewards by week and preserves totals as bigint-safe strings", () => {
    const rows = [
      {
        sender: "0xabc",
        amount: "1000000000000000000",
        timestamp: new Date("2026-01-05T10:00:00.000Z"),
      },
      {
        sender: "0xabc",
        amount: "2500000000000000000",
        timestamp: new Date("2026-01-06T10:00:00.000Z"),
      },
      {
        sender: "0xdef",
        amount: "4000000000000000000",
        timestamp: new Date("2026-01-14T10:00:00.000Z"),
      },
    ];

    const weekly = aggregateRewardsByWeek(
      rows,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-20T00:00:00.000Z"),
    );

    const firstWeek = weekly.find((row) => row.week === "2026-01-05");
    const secondWeek = weekly.find((row) => row.week === "2026-01-12");

    expect(firstWeek?.totalWei).toBe("3500000000000000000");
    expect(secondWeek?.totalWei).toBe("4000000000000000000");
  });
});

describe("aggregateRewardsBySource", () => {
  it("returns sorted source totals with share percentages", () => {
    const rows = [
      {
        sender: "0xabc",
        amount: "5000000000000000000",
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        sender: "0xabc",
        amount: "1000000000000000000",
        timestamp: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        sender: "0xdef",
        amount: "4000000000000000000",
        timestamp: new Date("2026-01-03T00:00:00.000Z"),
      },
    ];

    const breakdown = aggregateRewardsBySource(rows);

    expect(breakdown[0]?.sender).toBe("0xabc");
    expect(breakdown[0]?.totalWei).toBe("6000000000000000000");
    expect(breakdown[0]?.sharePercent).toBe("60.00");
    expect(breakdown[1]?.sharePercent).toBe("40.00");
  });
});

describe("sumRewardsInLastNDays", () => {
  it("sums rows from trailing window", () => {
    const now = new Date("2026-02-12T00:00:00.000Z");
    const rows = [
      {
        sender: "0xabc",
        amount: "2000000000000000000",
        timestamp: new Date("2026-02-10T00:00:00.000Z"),
      },
      {
        sender: "0xdef",
        amount: "3000000000000000000",
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];

    expect(sumRewardsInLastNDays(rows, 7, now)).toBe("2000000000000000000");
    expect(sumRewardsInLastNDays(rows, 60, now)).toBe("5000000000000000000");
  });
});

describe("aggregateLockActivityByWeek", () => {
  it("returns weekly lock update counts and unique owners", () => {
    const rows = [
      { owner: "0xa", timestamp: new Date("2026-01-05T00:00:00.000Z") },
      { owner: "0xa", timestamp: new Date("2026-01-06T00:00:00.000Z") },
      { owner: "0xb", timestamp: new Date("2026-01-07T00:00:00.000Z") },
      { owner: "0xb", timestamp: new Date("2026-01-13T00:00:00.000Z") },
    ];

    const weekly = aggregateLockActivityByWeek(
      rows,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-20T00:00:00.000Z"),
    );

    const firstWeek = weekly.find((row) => row.week === "2026-01-05");
    const secondWeek = weekly.find((row) => row.week === "2026-01-12");

    expect(firstWeek?.updates).toBe(3);
    expect(firstWeek?.uniqueWallets).toBe(2);
    expect(secondWeek?.updates).toBe(1);
    expect(secondWeek?.uniqueWallets).toBe(1);
  });
});
