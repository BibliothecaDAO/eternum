import { describe, it, expect } from "vitest";
import { detectThreats } from "../../../src/map/threat-detection.js";

function makeTile(x: number, y: number, occupierId: number, occupierType: number, isOwned: boolean) {
  return { x, y, occupierId, occupierType, isOwned };
}

describe("detectThreats", () => {
  it("returns empty when no enemies near structures", () => {
    const ownedStructures = [makeTile(10, 10, 1, 1, true)];
    const allTiles = [makeTile(10, 10, 1, 1, true), makeTile(12, 12, 2, 15, false)];
    const alerts = detectThreats(ownedStructures, allTiles, new Set());
    expect(alerts).toHaveLength(0);
  });

  it("detects enemy army adjacent to owned structure", () => {
    const ownedStructures = [makeTile(10, 10, 1, 1, true)];
    // (11, 10) is EAST neighbor of (10, 10) when row is even
    const allTiles = [
      makeTile(10, 10, 1, 1, true),
      makeTile(11, 10, 99, 15, false), // adjacent enemy knight
    ];
    const alerts = detectThreats(ownedStructures, allTiles, new Set());
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].enemyEntityId).toBe(99);
  });

  it("skips already-alerted positions", () => {
    const ownedStructures = [makeTile(10, 10, 1, 1, true)];
    const allTiles = [makeTile(10, 10, 1, 1, true), makeTile(11, 10, 99, 15, false)];
    const recentAlerts = new Set(["11,10"]);
    const alerts = detectThreats(ownedStructures, allTiles, recentAlerts);
    expect(alerts).toHaveLength(0);
  });

  it("ignores owned armies near structures", () => {
    const ownedStructures = [makeTile(10, 10, 1, 1, true)];
    const allTiles = [
      makeTile(10, 10, 1, 1, true),
      makeTile(11, 10, 50, 15, true), // owned army — not a threat
    ];
    const alerts = detectThreats(ownedStructures, allTiles, new Set());
    expect(alerts).toHaveLength(0);
  });
});
