import { describe, expect, it } from "vitest";

import {
  ArmyStaminaReading,
  pickFresherArmyStaminaReading,
  resolveFreshestArmyStaminaSource,
} from "./army-stamina-source";

const snapshotAtTick = (updatedTick: number) => ({
  onChainStamina: { amount: 100n, updatedTick },
});

describe("resolveFreshestArmyStaminaSource", () => {
  it("returns undefined when neither snapshot exists", () => {
    expect(resolveFreshestArmyStaminaSource({})).toBeUndefined();
  });

  it("falls back to the only available snapshot", () => {
    expect(resolveFreshestArmyStaminaSource({ liveSnapshot: snapshotAtTick(10) })).toBe("live");
    expect(resolveFreshestArmyStaminaSource({ enhancedSnapshot: snapshotAtTick(10) })).toBe("enhanced");
  });

  it("prefers the snapshot with the higher updated tick", () => {
    expect(
      resolveFreshestArmyStaminaSource({
        liveSnapshot: snapshotAtTick(11),
        enhancedSnapshot: snapshotAtTick(10),
      }),
    ).toBe("live");

    expect(
      resolveFreshestArmyStaminaSource({
        liveSnapshot: snapshotAtTick(10),
        enhancedSnapshot: snapshotAtTick(11),
      }),
    ).toBe("enhanced");
  });

  it("resolves an updated-tick tie to live, not the stale enhanced row", () => {
    // Regression pin: the enhanced snapshot is the up-to-a-poll-interval-stale
    // SQL map row. On a tie the RECS-synced live reading must win, so the 3D
    // label agrees with the detail panel's resolution order.
    expect(
      resolveFreshestArmyStaminaSource({
        liveSnapshot: snapshotAtTick(100),
        enhancedSnapshot: snapshotAtTick(100),
      }),
    ).toBe("live");
  });

  it("treats a missing on-chain stamina as tick 0", () => {
    expect(
      resolveFreshestArmyStaminaSource({
        liveSnapshot: {},
        enhancedSnapshot: snapshotAtTick(1),
      }),
    ).toBe("enhanced");

    expect(
      resolveFreshestArmyStaminaSource({
        liveSnapshot: {},
        enhancedSnapshot: {},
      }),
    ).toBe("live");
  });
});

describe("pickFresherArmyStaminaReading", () => {
  const reading = (overrides: Partial<ArmyStaminaReading>): ArmyStaminaReading => ({
    source: "live",
    updatedTick: 0,
    ...overrides,
  });

  it("prefers the higher updated tick regardless of source", () => {
    const cached = reading({ source: "cached", updatedTick: 5 });
    const pending = reading({ source: "pending", updatedTick: 4 });

    expect(pickFresherArmyStaminaReading(cached, pending)).toBe(cached);
    expect(pickFresherArmyStaminaReading(pending, cached)).toBe(cached);
  });

  it("breaks updated-tick ties by source priority: pending > live > snapshot > cached", () => {
    // live over snapshot: same-tick spends reuse the updated tick, so the
    // frozen one-shot snapshot ties with the RECS row that carries the spend.
    // The snapshot winning pinned the panel at the pre-move stamina until a
    // remount refetch (Aug 13 playtest).
    const pending = reading({ source: "pending", updatedTick: 7 });
    const snapshot = reading({ source: "snapshot", updatedTick: 7 });
    const live = reading({ source: "live", updatedTick: 7 });
    const cached = reading({ source: "cached", updatedTick: 7 });

    expect(pickFresherArmyStaminaReading(live, pending)).toBe(pending);
    expect(pickFresherArmyStaminaReading(snapshot, live)).toBe(live);
    expect(pickFresherArmyStaminaReading(cached, snapshot)).toBe(snapshot);
  });

  it("breaks full ties by capture time, preferring left on equal capture", () => {
    const older = reading({ updatedTick: 3, capturedAtMs: 1_000 });
    const newer = reading({ updatedTick: 3, capturedAtMs: 2_000 });

    expect(pickFresherArmyStaminaReading(older, newer)).toBe(newer);
    expect(pickFresherArmyStaminaReading(newer, older)).toBe(newer);

    const left = reading({ updatedTick: 3, capturedAtMs: 1_000 });
    const right = reading({ updatedTick: 3, capturedAtMs: 1_000 });
    expect(pickFresherArmyStaminaReading(left, right)).toBe(left);
  });
});
