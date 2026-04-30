import { beforeEach, describe, expect, it } from "vitest";

import { clearArmyMovementLatencyTrace, recordArmyMovementLatencyPhase } from "./army-movement-latency-trace";
import {
  ARMY_MOVEMENT_LATENCY_PHASE_PAIRS,
  computePercentile,
  summarizeArmyMovementLatency,
} from "./army-movement-latency-summary";

function record(
  entityId: number,
  phase: Parameters<typeof recordArmyMovementLatencyPhase>[0]["phase"],
  wallTimeMs: number,
  txHash?: string,
) {
  recordArmyMovementLatencyPhase({
    entityId,
    phase,
    source: "worldmap",
    wallTimeMs,
    txHash,
  });
}

describe("computePercentile", () => {
  it("returns 0 for empty input", () => {
    expect(computePercentile([], 0.5)).toBe(0);
  });

  it("handles single value", () => {
    expect(computePercentile([42], 0.5)).toBe(42);
    expect(computePercentile([42], 0.95)).toBe(42);
  });

  it("computes nearest-rank percentile", () => {
    const values = [10, 20, 30, 40, 50];
    expect(computePercentile(values, 0.5)).toBe(30);
    expect(computePercentile(values, 0.95)).toBe(50);
    expect(computePercentile(values, 0.2)).toBe(10);
  });

  it("sorts unsorted input before computing", () => {
    expect(computePercentile([50, 10, 30, 20, 40], 0.5)).toBe(30);
  });
});

describe("summarizeArmyMovementLatency", () => {
  beforeEach(() => {
    clearArmyMovementLatencyTrace();
  });

  it("returns empty summary for no entries", () => {
    const summary = summarizeArmyMovementLatency();

    expect(summary.sampleCount).toBe(0);
    expect(summary.phasePairs.every((p) => p.count === 0)).toBe(true);
  });

  it("computes delta for a single move_requested → movement_started pair", () => {
    record(7, "move_requested", 100);
    record(7, "movement_started", 450);

    const summary = summarizeArmyMovementLatency();
    const pair = summary.phasePairs.find((p) => p.pair.from === "move_requested" && p.pair.to === "movement_started");

    expect(pair).toBeDefined();
    expect(pair?.count).toBe(1);
    expect(pair?.p50Ms).toBe(350);
    expect(pair?.recentDeltasMs).toEqual([350]);
  });

  it("groups by entityId so parallel moves don't mix", () => {
    record(1, "move_requested", 100);
    record(2, "move_requested", 110);
    record(1, "movement_started", 500);
    record(2, "movement_started", 800);

    const summary = summarizeArmyMovementLatency();
    const pair = summary.phasePairs.find((p) => p.pair.from === "move_requested" && p.pair.to === "movement_started");

    expect(pair?.count).toBe(2);
    expect(pair?.recentDeltasMs.slice().sort((a, b) => a - b)).toEqual([400, 690]);
  });

  it("pairs each from with the first subsequent to for the same entity", () => {
    record(5, "move_requested", 0);
    record(5, "movement_started", 100);
    record(5, "movement_completed", 500);
    record(5, "move_requested", 1000);
    record(5, "movement_started", 1200);

    const summary = summarizeArmyMovementLatency();
    const startPair = summary.phasePairs.find(
      (p) => p.pair.from === "move_requested" && p.pair.to === "movement_started",
    );

    expect(startPair?.count).toBe(2);
    expect(startPair?.recentDeltasMs.slice().sort((a, b) => a - b)).toEqual([100, 200]);
  });

  it("ignores a from without a matching to", () => {
    record(9, "move_requested", 0);
    // No movement_started follows.

    const summary = summarizeArmyMovementLatency();
    const startPair = summary.phasePairs.find(
      (p) => p.pair.from === "move_requested" && p.pair.to === "movement_started",
    );

    expect(startPair?.count).toBe(0);
  });

  it("keeps only the most recent from when multiple arrive without a to", () => {
    record(3, "move_requested", 0);
    record(3, "move_requested", 100);
    record(3, "movement_started", 300);

    const summary = summarizeArmyMovementLatency();
    const startPair = summary.phasePairs.find(
      (p) => p.pair.from === "move_requested" && p.pair.to === "movement_started",
    );

    expect(startPair?.count).toBe(1);
    expect(startPair?.recentDeltasMs).toEqual([200]);
  });

  it("computes p50/p95 across multiple samples", () => {
    for (let i = 0; i < 10; i += 1) {
      record(i + 1, "move_requested", i * 1000);
      record(i + 1, "movement_started", i * 1000 + 100 + i * 10);
    }

    const summary = summarizeArmyMovementLatency();
    const pair = summary.phasePairs.find((p) => p.pair.from === "move_requested" && p.pair.to === "movement_started");

    expect(pair?.count).toBe(10);
    expect(pair?.p50Ms).toBeGreaterThan(0);
    expect(pair?.p95Ms).toBeGreaterThanOrEqual(pair?.p50Ms ?? 0);
    expect(pair?.recentDeltasMs.length).toBeLessThanOrEqual(10);
  });

  it("publishes summary to globalThis", () => {
    record(1, "move_requested", 10);
    record(1, "movement_started", 110);

    summarizeArmyMovementLatency();

    const published = (globalThis as { __armyMovementLatencySummary?: unknown }).__armyMovementLatencySummary;
    expect(published).toBeDefined();
  });

  it("exposes the expected canonical phase pairs", () => {
    const pairs = ARMY_MOVEMENT_LATENCY_PHASE_PAIRS.map((p) => `${p.from}->${p.to}`);

    expect(pairs).toContain("move_requested->tx_confirmed");
    expect(pairs).toContain("tx_confirmed->tileopt_stream_received");
    expect(pairs).toContain("tileopt_stream_received->movement_started");
    expect(pairs).toContain("move_requested->movement_started");
    expect(pairs).toContain("movement_started->movement_completed");
    expect(pairs).toContain("tx_submitted->optimistic_animation_started");
  });
});
