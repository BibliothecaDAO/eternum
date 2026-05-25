import { beforeEach, describe, expect, it } from "vitest";

import {
  clearArmyMovementLatencyTrace,
  recordArmyMovementLatencyPhase,
  snapshotArmyMovementLatencyTrace,
} from "./army-movement-latency-trace";

describe("army-movement-latency-trace", () => {
  beforeEach(() => {
    clearArmyMovementLatencyTrace();
  });

  it("records trace entries in order", () => {
    recordArmyMovementLatencyPhase({
      entityId: 7,
      phase: "tx_submitted",
      source: "worldmap",
    });
    recordArmyMovementLatencyPhase({
      entityId: 7,
      phase: "movement_started",
      source: "worldmap",
    });

    const trace = snapshotArmyMovementLatencyTrace();

    expect(trace).toHaveLength(2);
    expect(trace[0]?.phase).toBe("tx_submitted");
    expect(trace[1]?.phase).toBe("movement_started");
    expect(trace[0]?.sequence).toBeLessThan(trace[1]?.sequence ?? 0);
  });

  it("clears recorded entries", () => {
    recordArmyMovementLatencyPhase({
      entityId: 9,
      phase: "tx_confirmed",
      source: "worldmap",
    });

    clearArmyMovementLatencyTrace();

    expect(snapshotArmyMovementLatencyTrace()).toEqual([]);
  });
});
