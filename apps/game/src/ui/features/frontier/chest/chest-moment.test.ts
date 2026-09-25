import { beforeEach, describe, expect, it, vi } from "vitest";

const { plays, stops, finished } = vi.hoisted(() => ({
  plays: [] as string[],
  stops: [] as unknown[],
  finished: { count: 0 },
}));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: {
    getInstance: () => ({
      play: (id: string) => {
        plays.push(id);
        return Promise.resolve({ id });
      },
      stop: (source: unknown) => stops.push(source),
    }),
  },
}));
vi.mock("@/ui/motion/motion-layer", () => ({ finishFlights: () => (finished.count += 1) }));

import {
  advanceChestMoment,
  beginChestOpening,
  canSkipChestMoment,
  cancelChestOpening,
  chestTimeline,
  closeChestMoment,
  resolveChestOpening,
  skipChestMoment,
} from "./chest-moment";

const EPIC_LORDS = { outcome: { kind: "lords" as const, intensity: 3 as const, lords: 6_000 } };
const COMMON_LORDS = { outcome: { kind: "lords" as const, intensity: 0 as const, lords: 100 } };

beforeEach(() => {
  closeChestMoment();
  plays.length = 0;
  stops.length = 0;
  finished.count = 0;
});

describe("the chest's timeline", () => {
  it("holds longer and plays bigger with rarity, and an epic alone shakes and flashes", () => {
    expect(chestTimeline(0, 1)).toMatchObject({ tellMs: 250, burstMs: 300, fountainCoins: 8, flyingCoins: 8 });
    expect(chestTimeline(3, 1)).toMatchObject({ tellMs: 950, fountainCoins: 64, flyingCoins: 24, shake: true });
    expect([0, 1, 2, 3].map((level) => chestTimeline(level as 0 | 1 | 2 | 3, 1).flash)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect([0, 1, 2, 3].map((level) => chestTimeline(level as 0 | 1 | 2 | 3, 1).beam)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it("shortens the hold to 250 ms and halves the fountain on a repeat", () => {
    expect(chestTimeline(1, 0.5)).toMatchObject({ minAnticipationMs: 250, fountainCoins: 8, burstMs: 150 });
    expect(chestTimeline(1, 1).minAnticipationMs).toBe(600);
  });
});

describe("skipping", () => {
  it("needs a result, and lets an epic be skipped only after 400 ms of its tell", () => {
    expect(canSkipChestMoment({ result: null, tellAt: null }, 0)).toBe(false);
    expect(canSkipChestMoment({ result: COMMON_LORDS, tellAt: null }, 0)).toBe(true);
    expect(canSkipChestMoment({ result: EPIC_LORDS, tellAt: null }, 1_000)).toBe(false);
    expect(canSkipChestMoment({ result: EPIC_LORDS, tellAt: 1_000 }, 1_399)).toBe(false);
    expect(canSkipChestMoment({ result: EPIC_LORDS, tellAt: 1_000 }, 1_400)).toBe(true);
  });
});

describe("an opening", () => {
  it("taps and charges, stops the charge at the tell, and a skip lands every flight", async () => {
    beginChestOpening({ x: 10, y: 20 }, 0);
    expect(plays).toEqual(["chest.tap", "chest.charge"]);
    skipChestMoment(100);
    expect(finished.count).toBe(0);
    resolveChestOpening(COMMON_LORDS, 700);
    advanceChestMoment("tell", 700);
    await Promise.resolve();
    expect(stops).toHaveLength(1);
    skipChestMoment(750);
    expect(finished.count).toBe(1);
  });

  it("ends where it is when the opening fails", async () => {
    beginChestOpening({ x: 10, y: 20 }, 0);
    cancelChestOpening();
    await Promise.resolve();
    expect(stops).toHaveLength(1);
  });
});
