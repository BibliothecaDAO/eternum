// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { WorldSummary } from "@bibliothecadao/types";

import { partitionWorlds, type WorldPartition } from "./use-partitioned-worlds";

const make = (name: string, overrides: Partial<WorldSummary>): WorldSummary => ({
  name,
  chain: "madara",
  alive: true,
  lastCheckedAt: 0,
  mode: null,
  startSettlingAt: null,
  startMainAt: null,
  endAt: null,
  devModeOn: null,
  mmrEnabled: null,
  singleRealmMode: null,
  twoPlayerMode: null,
  seasonPassAddress: null,
  villagePassAddress: null,
  worldAddress: null,
  prizeDistributionAddress: null,
  entryTokenAddress: null,
  feeTokenAddress: null,
  feeAmount: null,
  registrationCount: null,
  registrationCountMax: null,
  registrationStartAt: null,
  registrationEndAt: null,
  settledPlayersCount: null,
  settledRealmsCount: null,
  settledVillagesCount: null,
  winnerJackpotAmount: null,
  ...overrides,
});

describe("partitionWorlds", () => {
  const now = 1_000_000;

  it("buckets a live world into live", () => {
    const summary = make("live-1", {
      alive: true,
      startMainAt: now - 100,
      endAt: now + 1000,
    });
    const partition = partitionWorlds([summary], now);
    expectExactly(partition, { live: ["live-1"] });
  });

  it("buckets a future world into upcoming", () => {
    const summary = make("upcoming-1", {
      alive: true,
      startMainAt: now + 500,
      endAt: now + 2000,
    });
    const partition = partitionWorlds([summary], now);
    expectExactly(partition, { upcoming: ["upcoming-1"] });
  });

  it("buckets a past-endAt world into ended", () => {
    const summary = make("ended-1", {
      alive: true,
      startMainAt: now - 2000,
      endAt: now - 500,
    });
    const partition = partitionWorlds([summary], now);
    expectExactly(partition, { ended: ["ended-1"] });
  });

  it("buckets a dead world into offline regardless of timing", () => {
    const summary = make("offline-1", {
      alive: false,
      startMainAt: now - 100,
      endAt: now + 1000,
    });
    const partition = partitionWorlds([summary], now);
    expectExactly(partition, { offline: ["offline-1"] });
  });

  it("buckets a world without timing into unknown when alive", () => {
    const summary = make("unknown-1", {
      alive: true,
      startMainAt: null,
      endAt: null,
    });
    const partition = partitionWorlds([summary], now);
    expectExactly(partition, { unknown: ["unknown-1"] });
  });

  it("treats a live world with null endAt as live if startMainAt has passed", () => {
    const summary = make("live-open", {
      alive: true,
      startMainAt: now - 100,
      endAt: null,
    });
    const partition = partitionWorlds([summary], now);
    expectExactly(partition, { live: ["live-open"] });
  });

  it("handles a mix across all buckets", () => {
    const summaries = [
      make("live", { alive: true, startMainAt: now - 10, endAt: now + 10 }),
      make("upcoming", { alive: true, startMainAt: now + 10, endAt: now + 100 }),
      make("ended", { alive: true, startMainAt: now - 100, endAt: now - 10 }),
      make("offline", { alive: false }),
      make("unknown", { alive: true, startMainAt: null }),
    ];
    const partition = partitionWorlds(summaries, now);

    expect(partition.live.map((s) => s.name)).toEqual(["live"]);
    expect(partition.upcoming.map((s) => s.name)).toEqual(["upcoming"]);
    expect(partition.ended.map((s) => s.name)).toEqual(["ended"]);
    expect(partition.offline.map((s) => s.name)).toEqual(["offline"]);
    expect(partition.unknown.map((s) => s.name)).toEqual(["unknown"]);
  });

  it("handles empty input", () => {
    const partition = partitionWorlds([], now);
    expect(partition).toEqual({ live: [], upcoming: [], ended: [], offline: [], unknown: [] });
  });
});

function expectExactly(partition: WorldPartition, expected: Partial<Record<keyof WorldPartition, string[]>>): void {
  const buckets: (keyof WorldPartition)[] = ["live", "upcoming", "ended", "offline", "unknown"];
  for (const bucket of buckets) {
    const expectedNames = expected[bucket] ?? [];
    const actualNames = partition[bucket].map((s) => s.name);
    expect(actualNames).toEqual(expectedNames);
  }
}
